import { useAuth } from 'react-oidc-context';

export const About = () => {
  const auth = useAuth();

  const handleSignOut = async () => {
    // Clear local auth state first
    await auth.removeUser();

    // Then redirect to Cognito logout to clear server session
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = window.location.origin;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  return (
    <div className="h-full w-full overflow-y-auto p-9">
        <h1 className="text-2xl font-bold mb-6 text-gray-400">About</h1>

        <div className="space-y-6">
          {/* Account */}
          <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Account</h2>

            <div className="flex items-center justify-between py-3 border-b border-gray-700">
              <div className='flex'>
                <p className="text-sm font-medium text-gray-200">Sign Out</p>
                <p className="text-xs text-gray-500">Sign out of your NexCast account</p>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* About */}
          <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">About</h2>

            <div className="space-y-2 text-sm text-gray-300">
              <p>
                <strong>Version:</strong> 1.0.0
              </p>
              <p>
                <strong>Build:</strong> Development
              </p>
              <p className="pt-2 border-t border-gray-700">
                NexCast provides real-time AI-powered sports commentary for your gameplay sessions.
              </p>
            </div>
          </div>
        </div>
    </div>
  );
};

export default About;
