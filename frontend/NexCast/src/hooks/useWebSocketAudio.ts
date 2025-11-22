import { useCallback, useRef, useState } from "react";
import type { SessionPreferences } from "../services/api";

export const useWebSocketAudio = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextPlayTimeRef = useRef<number>(0);
    const audioQueueRef = useRef<AudioBuffer[]>([]);
    const MAX_QUEUE_SIZE = 2;

    const playNextAudio = useCallback(() => {
        if (!audioContextRef.current || audioQueueRef.current.length === 0) return;

        const audioBuffer = audioQueueRef.current.shift()!;
        const now = audioContextRef.current.currentTime;
        const startTime = Math.max(now, nextPlayTimeRef.current);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.start(startTime);

        nextPlayTimeRef.current = startTime + audioBuffer.duration;
        console.log(`Playing audio (queue: ${audioQueueRef.current.length}, duration: ${audioBuffer.duration.toFixed(2)}s)`);

        // Schedule next audio
        source.onended = () => {
            if (audioQueueRef.current.length > 0) {
                playNextAudio();
            }
        };
    }, []);

    const connect = useCallback((sessionId: number, preferences: SessionPreferences) => {
            const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                ws.send(JSON.stringify({
                    type: 'init',
                    preferences: preferences
                }))
            }

            ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'ready') {
                    setIsConnected(true);
                    setError(null);
                    console.log('WebSocket ready');
                }

                if (data.type === 'audio') {
                    try {
                        const audioBytes = Uint8Array.from(atob(data.audio), c=> c.charCodeAt(0))

                        if (!audioContextRef.current) {
                            audioContextRef.current = new AudioContext();
                        }

                        const audioBuffer = await audioContextRef.current.decodeAudioData(audioBytes.buffer)

                        // Drop oldest if queue is full
                        if (audioQueueRef.current.length >= MAX_QUEUE_SIZE) {
                            audioQueueRef.current.shift();
                            console.log('Queue full, dropped oldest audio');
                        }

                        audioQueueRef.current.push(audioBuffer);

                        // Start playback if not already playing
                        if (audioQueueRef.current.length === 1) {
                            playNextAudio();
                        }
                    } catch (err) {
                        console.error('Audio decode error:', err);
                        // Don't close connection on decode error, just skip this audio
                    }
                }
            }

            ws.onerror = (err) => {
                console.error('WebSocket error:', err);
                setError('WebSocket connection failed');
            }

            ws.onclose = (event) => {
                console.log('🔴 WEBSOCKET CLOSED');
                console.log('Close code:', event.code);
                console.log('Close reason:', event.reason);
                console.log('Was clean:', event.wasClean);
                console.trace('WebSocket close stack trace');
                setIsConnected(false);
            }
        }, [playNextAudio]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        // Clear audio queue
        audioQueueRef.current = [];
        nextPlayTimeRef.current = 0;
        setIsConnected(false);
    }, []);

    const sendFrame = useCallback((frameBase64: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'frame',
                frame: frameBase64.split(',')[1]    // remove "data:image/jpeg;base64" prefix
            }));
            console.log('Frame sent');
        }
    }, []);

    return { isConnected, error, connect, disconnect, sendFrame}
}


