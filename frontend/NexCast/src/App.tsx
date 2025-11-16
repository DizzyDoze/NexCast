import { useAuth } from 'react-oidc-context'
import { useEffect, useState } from 'react'
import { setAuthToken } from './services/api'
import Dashboard from './components/Dashboard'
import History from './components/History'
import './App.css'

type View = 'dashboard' | 'history'

interface AuthenticatedAppProps {
  signOut: () => void
  userEmail?: string
}

function AuthenticatedApp({ signOut, userEmail }: AuthenticatedAppProps) {
  const [currentView, setCurrentView] = useState<View>('dashboard')

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-blue-600">NexCast</h1>
            </div>

            {/* Navigation Links */}
            <div className="flex space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  currentView === 'dashboard'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('history')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  currentView === 'history'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                History
              </button>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{userEmail}</span>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'history' && <History />}
      </main>
    </div>
  )
}

function App() {
  const auth = useAuth()

  // Set auth token when user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.id_token) {
      setAuthToken(auth.user.id_token)
    } else {
      setAuthToken(null)
    }
  }, [auth.isAuthenticated, auth.user])

  const signOutRedirect = async () => {
    await auth.removeUser()
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const logoutUri = `${window.location.origin}/`
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
  }

  if (auth.isLoading) {
    return <div>Loading...</div>
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>
  }

  if (auth.isAuthenticated) {
    return <AuthenticatedApp signOut={signOutRedirect} userEmail={auth.user?.profile.email} />
  }

  return (
    <div className="container">
      <h1>NexCast - Live Gaming Commentary</h1>
      <p>Sign in to start your live commentary session</p>
      <button className='text-cyan-500' onClick={() => auth.signinRedirect()}>Sign In</button>
    </div>
  )
}

export default App
