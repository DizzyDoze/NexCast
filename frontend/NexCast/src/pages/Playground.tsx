import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useWebSocketAudio } from '../hooks/useWebSocketAudio';
import { SessionControl } from '../components/SessionControl';
import { ScreenPreview } from '../components/ScreenPreview';
import { PreferencesPanel } from '../components/PreferencesPanel';
import type { SessionPreferences } from '../interfaces/session';

export const Playground = () => {
  // Session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wsAudio = useWebSocketAudio();

  // Preferences state
  const [preferences, setPreferences] = useState<SessionPreferences>({
    speaker1_voice_id: 'qVpGLzi5EhjW3WGVhOa9', // American Urban (default)
    speaker2_voice_id: 'gU0LNdkMOQCOrPrwtbee', // British Announcer (default)
    capture_interval: 10000,
    player_name: '',
    context: 'A professional esports player competing in a major tournament with thousands of viewers watching live.',
  });

  // Screen capture hook
  const capture = useScreenCapture(preferences.capture_interval || 10000);

  // Timer ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update elapsed time
  useEffect(() => {
    if (isSessionActive && sessionStartTime) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isSessionActive, sessionStartTime]);

  // Send frames to WebSocket at user-configured interval
  useEffect(() => {
    if (isSessionActive && wsAudio.isConnected && capture.currentFrame) {
      wsAudio.sendFrame(capture.currentFrame);
    }
  }, [capture.frameCount]); // Only trigger when frameCount increments

  // Start session
  const handleStartSession = async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Start API session
      const response = await api.startSession(preferences);
      setSessionId(response.session_id);
      setIsSessionActive(true);
      setSessionStartTime(Date.now());

      // Start screen capture
      await capture.startCapture();

      // Connect WebSocket
      wsAudio.connect(response.session_id, preferences);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start session';
      setError(errorMessage);
      console.error('Start session error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // End session
  const handleEndSession = async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Disconnect WebSocket first
      wsAudio.disconnect();

      if (sessionId) {
        // End API session with frame count
        await api.endSession(sessionId, capture.frameCount);
      }

      // Stop screen capture
      capture.stopCapture();

      // Reset state
      setIsSessionActive(false);
      setSessionId(null);
      setSessionStartTime(null);
      setElapsedTime(0);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to end session';
      setError(errorMessage);
      console.error('End session error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <div className="w-full h-full overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">Live Commentary Playground</h1>
          <p className="text-gray-400 mt-1">Start and manage your live commentary sessions</p>
        </div>

        {/* Error Display */}
        {(error || capture.error || wsAudio.error) && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
            <strong>Error:</strong> {error || capture.error || wsAudio.error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Session Control & Preview */}
          <div className="lg:col-span-2 space-y-6">
            <SessionControl
              isSessionActive={isSessionActive}
              isLoading={isLoading}
              sessionId={sessionId}
              elapsedTime={elapsedTime}
              frameCount={capture.frameCount}
              isWebSocketConnected={wsAudio.isConnected}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
            />

            <ScreenPreview
              currentFrame={capture.currentFrame}
              isSessionActive={isSessionActive}
            />
          </div>

          {/* Right Column: Preferences */}
          <div>
            <PreferencesPanel
              preferences={preferences}
              isSessionActive={isSessionActive}
              onPreferencesChange={setPreferences}
            />
          </div>
        </div>
      </div>
  );
};

export default Playground;
