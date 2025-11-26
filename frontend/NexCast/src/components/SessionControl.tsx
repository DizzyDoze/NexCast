import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SessionControlProps {
  isSessionActive: boolean;
  isLoading: boolean;
  sessionId: number | null;
  elapsedTime: number;
  frameCount: number;
  isWebSocketConnected: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
}

export const SessionControl = ({
  isSessionActive,
  isLoading,
  sessionId,
  elapsedTime,
  frameCount,
  isWebSocketConnected,
  onStartSession,
  onEndSession,
}: SessionControlProps) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold text-white">Session Status</CardTitle>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
          isSessionActive
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-gray-700 text-gray-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-emerald-400' : 'bg-gray-500'}`} />
          {isSessionActive ? 'Active' : 'Idle'}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isSessionActive && (
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Session ID</p>
              <p className="text-xl font-semibold text-white">{sessionId}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Duration</p>
              <p className="text-xl font-semibold font-mono text-white">{formatTime(elapsedTime)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Frames</p>
              <p className="text-xl font-semibold text-white">{frameCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Connection</p>
              <p className="text-xl">
                {isWebSocketConnected ? '🟢' : '🔴'}
              </p>
            </div>
          </div>
        )}

        {!isSessionActive ? (
          <Button
            onClick={onStartSession}
            disabled={isLoading}
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? 'Starting...' : 'Start Commentary Session'}
          </Button>
        ) : (
          <Button
            onClick={onEndSession}
            disabled={isLoading}
            size="lg"
            variant="destructive"
            className="w-full"
          >
            {isLoading ? 'Ending...' : 'End Session'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionControl;
