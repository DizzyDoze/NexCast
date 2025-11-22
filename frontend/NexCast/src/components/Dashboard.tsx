import { useState, useEffect, useRef } from 'react';
import { api, SessionPreferences } from '../services/api';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useWebSocketAudio } from '../hooks/useWebSocketAudio';


// Available Google TTS voices
const VOICE_OPTIONS = [
  { value: 'en-US-Neural2-A', label: 'Male (Neural2-A)' },
  { value: 'en-US-Neural2-D', label: 'Female (Neural2-D)' },
  { value: 'en-US-Neural2-C', label: 'Female (Neural2-C)' },
  { value: 'en-US-Neural2-J', label: 'Male (Neural2-J)' },
];

const STYLE_OPTIONS = [
  { value: 'excited', label: 'Excited' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'humorous', label: 'Humorous' },
];

export const Dashboard = () => {
  // Session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wsAudio = useWebSocketAudio()

  // Preferences state
  const [preferences, setPreferences] = useState<SessionPreferences>({
    voice: 'en-US-Neural2-A',
    commentary_style: 'excited',
    speaking_rate: 1.0,
    pitch: 0.0,
    volume: 100,
    capture_interval: 3000,
  });

  // Screen capture hook
  const capture = useScreenCapture(preferences.capture_interval || 3000);

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

  // Format elapsed time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      wsAudio.connect(response.session_id, preferences)
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

      // Disconnect WebSocket frist
      wsAudio.disconnect()

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
    <div className="w-full max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Live Commentary Dashboard</h1>

      {/* Error Display */}
      {(error || capture.error || wsAudio.error) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error || capture.error || wsAudio.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Session Control & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Session Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Session Status</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isSessionActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {isSessionActive ? 'Active' : 'Idle'}
              </span>
            </div>

            {/* Session Info */}
            {isSessionActive && (
              <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">Session ID</p>
                  <p className="text-2xl font-bold">{sessionId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="text-2xl font-bold">{formatTime(elapsedTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Frames</p>
                  <p className="text-2xl font-bold">{capture.frameCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">WebSocket</p>
                  <p className="text-2xl font-bold">
                    {wsAudio.isConnected ? '🟢' : '🔴'}
                  </p>
                </div>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-4">
              {!isSessionActive ? (
                <button
                  onClick={handleStartSession}
                  disabled={isLoading}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? 'Starting...' : 'Start Commentary Session'}
                </button>
              ) : (
                <button
                  onClick={handleEndSession}
                  disabled={isLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? 'Ending...' : 'End Session'}
                </button>
              )}
            </div>
          </div>

          {/* Screen Preview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Screen Preview</h2>
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
              {capture.currentFrame ? (
                <img
                  src={capture.currentFrame}
                  alt="Screen capture"
                  className="w-full h-full object-contain"
                />
              ) : (
                <p className="text-gray-400">
                  {isSessionActive
                    ? 'Waiting for first frame...'
                    : 'Start a session to see screen preview'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Preferences */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>

            <div className="space-y-4">
              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice
                </label>
                <select
                  value={preferences.voice}
                  onChange={(e) =>
                    setPreferences({ ...preferences, voice: e.target.value })
                  }
                  disabled={isSessionActive}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
                >
                  {VOICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Commentary Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commentary Style
                </label>
                <select
                  value={preferences.commentary_style}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      commentary_style: e.target.value,
                    })
                  }
                  disabled={isSessionActive}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
                >
                  {STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speaking Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speaking Rate: {preferences.speaking_rate}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={preferences.speaking_rate}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      speaking_rate: parseFloat(e.target.value),
                    })
                  }
                  disabled={isSessionActive}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>

              {/* Pitch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pitch: {preferences.pitch > 0 ? '+' : ''}
                  {preferences.pitch}
                </label>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={preferences.pitch}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      pitch: parseFloat(e.target.value),
                    })
                  }
                  disabled={isSessionActive}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Lower</span>
                  <span>Normal</span>
                  <span>Higher</span>
                </div>
              </div>

              {/* Volume */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Volume: {preferences.volume}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={preferences.volume}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      volume: parseInt(e.target.value),
                    })
                  }
                  disabled={isSessionActive}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Capture Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capture Interval: {(preferences.capture_interval || 3000) / 1000}s
                </label>
                <input
                  type="range"
                  min="5000"
                  max="10000"
                  step="500"
                  value={preferences.capture_interval || 7500}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      capture_interval: parseInt(e.target.value),
                    })
                  }
                  disabled={isSessionActive}
                  className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>5s (Fast)</span>
                  <span>7.5s</span>
                  <span>10s (Slow)</span>
                </div>
              </div>
            </div>

            {isSessionActive && (
              <p className="text-xs text-gray-500 mt-4 italic">
                Preferences are locked during active session
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
