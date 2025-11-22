import { useState, useRef, useCallback, useEffect } from 'react';

export interface ScreenCaptureState {
  isCapturing: boolean;
  frameCount: number;
  currentFrame: string | null; // Base64 image data
  error: string | null;
}

export interface UseScreenCaptureReturn extends ScreenCaptureState {
  startCapture: () => Promise<void>;
  stopCapture: () => void;
}

/**
 * Hook for capturing screen frames
 * @param captureInterval - Interval between captures in milliseconds (default: 2000ms)
 */
export const useScreenCapture = (
  captureInterval: number = 5000
): UseScreenCaptureReturn => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const animationIdRef = useRef<number | null>(null);

  /**
   * Render preview continuously (30 FPS like Zoom/Meet)
   */
  const renderPreview = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 for preview
    const frameData = canvas.toDataURL('image/jpeg', 0.8);
    setCurrentFrame(frameData);

    // Continue loop
    animationIdRef.current = requestAnimationFrame(renderPreview);
  }, []);

  /**
   * Capture a single frame for processing (interval-based for LLM)
   */
  const captureFrame = useCallback(() => {
    // Increment frame count (will be used for Phase 2 LLM processing)
    setFrameCount((prev) => prev + 1);
  }, []);

  /**
   * Start screen capture
   */
  const startCapture = useCallback(async () => {
    try {
      setError(null);

      // Request screen capture permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        } as MediaTrackConstraints,
        audio: false,
      });

      mediaStreamRef.current = stream;

      // Create video element to capture frames from
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      videoRef.current = video;

      // Create canvas for frame capture
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Start capturing frames
      setIsCapturing(true);
      setFrameCount(0);

      // Start continuous preview (30 FPS)
      animationIdRef.current = requestAnimationFrame(renderPreview);

      // Start interval counter for LLM processing (Phase 2)
      intervalIdRef.current = setInterval(captureFrame, captureInterval);

      // Handle user stopping screen share
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('🔴 SCREEN SHARE ENDED - MediaStream track ended event fired');
        console.trace('Screen share end stack trace');
        stopCapture();
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to start screen capture';
      setError(errorMessage);
      console.error('Screen capture error:', err);
    }
  }, [captureFrame, captureInterval, renderPreview]);

  /**
   * Stop screen capture
   */
  const stopCapture = useCallback(() => {
    // Clear animation frame
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    // Clear interval
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Clean up video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    canvasRef.current = null;
    setIsCapturing(false);
    setCurrentFrame(null); // Clear preview
    setFrameCount(0); // Reset counter
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    isCapturing,
    frameCount,
    currentFrame,
    error,
    startCapture,
    stopCapture,
  };
};

export default useScreenCapture;
