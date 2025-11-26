import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, type Session } from '../services/api';

export const SessionHistory = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.getHistory();
      setSessions(response.sessions);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load session history';
      setError(errorMessage);
      console.error('Load sessions error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="h-full w-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Session History</h1>
            <p className="text-gray-400 mt-1">View and manage your commentary sessions</p>
          </div>
          <Button
            onClick={loadSessions}
            disabled={isLoading}
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-700"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">Loading sessions...</div>
          </div>
        )}

        {/* Sessions List */}
        {!isLoading && !error && (
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-gray-400 text-center">
                    No sessions found. Start a session in the Playground to see it here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              sessions.map((session) => (
                <Card key={session.session_id} className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-6 flex-1">
                        <div className="space-y-0.5 min-w-[100px]">
                          <p className="text-xs text-gray-400">Session</p>
                          <p className="text-sm font-semibold text-white">#{session.session_id}</p>
                        </div>
                        <div className="space-y-0.5 min-w-[160px]">
                          <p className="text-xs text-gray-400">Started</p>
                          <p className="text-sm text-gray-300">{formatDate(session.started_at)}</p>
                        </div>
                        <div className="space-y-0.5 min-w-[100px]">
                          <p className="text-xs text-gray-400">Duration</p>
                          <p className="text-sm font-mono text-gray-300">{formatDuration(session.duration)}</p>
                        </div>
                        <div className="space-y-0.5 min-w-[80px]">
                          <p className="text-xs text-gray-400">Frames</p>
                          <p className="text-sm text-gray-300">{session.frame_count}</p>
                        </div>
                        <div className="space-y-0.5 min-w-[100px]">
                          <p className="text-xs text-gray-400">Speakers</p>
                          <p className="text-sm text-gray-300">
                            {session.preferences.speaker2_voice_id ? 'Dual' : 'Single'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                            session.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : session.status === 'active'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            session.status === 'completed'
                              ? 'bg-emerald-400'
                              : session.status === 'active'
                              ? 'bg-blue-400'
                              : 'bg-red-400'
                          }`} />
                          {session.status}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
    </div>
  );
};

export default SessionHistory;
