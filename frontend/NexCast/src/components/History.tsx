import { useState, useEffect } from 'react';
import { api, Session, SessionDetail } from '../services/api';

export const History = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load session history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getHistory();
      setSessions(data.sessions);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load history';
      setError(errorMessage);
      console.error('Load history error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getSessionDetails(sessionId);
      setSelectedSession(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load session details';
      setError(errorMessage);
      console.error('Load session details error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Session History</h1>
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Sessions List */}
      {!selectedSession ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isLoading && sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No sessions found. Start your first commentary session!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frames
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <tr key={session.session_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{session.session_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(session.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(session.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {session.frame_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            session.status === 'ended'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => loadSessionDetails(session.session_id)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Session Detail View */
        <div className="space-y-6">
          <button
            onClick={() => setSelectedSession(null)}
            className="text-blue-600 hover:text-blue-900 font-medium"
          >
            ← Back to List
          </button>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">
              Session #{selectedSession.session_id}
            </h2>

            {/* Session Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Started</p>
                <p className="font-semibold">
                  {formatDate(selectedSession.started_at)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ended</p>
                <p className="font-semibold">
                  {selectedSession.ended_at
                    ? formatDate(selectedSession.ended_at)
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-semibold">
                  {formatDuration(selectedSession.duration)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Frames Captured</p>
                <p className="font-semibold">{selectedSession.frame_count}</p>
              </div>
            </div>

            {/* Preferences */}
            <div className="border-t pt-4 mb-6">
              <h3 className="text-lg font-semibold mb-3">Preferences Used</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Voice</p>
                  <p className="font-medium">
                    {selectedSession.preferences.voice || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Style</p>
                  <p className="font-medium capitalize">
                    {selectedSession.preferences.commentary_style || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Speaking Rate</p>
                  <p className="font-medium">
                    {selectedSession.preferences.speaking_rate}x
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pitch</p>
                  <p className="font-medium">
                    {selectedSession.preferences.pitch > 0 ? '+' : ''}
                    {selectedSession.preferences.pitch}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Volume</p>
                  <p className="font-medium">
                    {selectedSession.preferences.volume}%
                  </p>
                </div>
              </div>
            </div>

            {/* Commentaries (Phase 2 feature) */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3">
                Commentaries ({selectedSession.commentaries.length})
              </h3>
              {selectedSession.commentaries.length === 0 ? (
                <p className="text-gray-500 italic">
                  No commentaries generated (Phase 2 feature)
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedSession.commentaries.map((commentary) => (
                    <div
                      key={commentary.id}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <p className="text-sm text-gray-600 mb-1">
                        {formatDate(commentary.created_at)} - Model:{' '}
                        {commentary.commentator_model}
                      </p>
                      <p className="font-medium mb-2">
                        {commentary.commentary_text}
                      </p>
                      <p className="text-sm text-gray-500 italic">
                        Scene: {commentary.scene_description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
