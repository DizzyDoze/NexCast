import { useAuth } from 'react-oidc-context'
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { setAuthToken } from './services/api'
import { SideBar } from './components/SideBar'
import Playground from './pages/Playground'
import SessionHistory from './pages/SessionHistory'
import { About } from './pages/About'
import './App.css'

function AuthenticatedApp() {
  return (
    <BrowserRouter>
      <div className="h-full w-full flex overflow-hidden bg-gray-900">
        {/* Sidebar */}
        <SideBar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-900">
          <Routes>
            <Route path="/playground" element={<Playground />} />
            <Route path="/history" element={<SessionHistory />} />
            <Route path="/settings" element={<About />} />
            <Route path="/" element={<Navigate to="/playground" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
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

  if (auth.isLoading) {
    return <div>Loading...</div>
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>
  }

  if (auth.isAuthenticated) {
    return <AuthenticatedApp />
  }

  return (
    // back ground gradiant color, from bottom left to the other side
    <div className="h-screen w-screen bg-linear-to-bl from-gray-100 to-gray-800 flex items-center justify-center">
      <div className="w-full max-w-md mx-4 bg-gray-800 rounded-xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="mb-3">
          <h1 className="text-4xl font-bold text-gray-100 mb-1">NexCast</h1>
          <p className="text-xl text-gray-100">Live Gaming Commentary</p>
        </div>
        <button
          className="w-full bg-gray-800 hover:bg-gray-800 text-gray-100 font-medium py-3 px-6 rounded-lg transition-colors"
          onClick={() => auth.signinRedirect()}
        >
          Sign In with Cognito
        </button>
      </div>
    </div>
  )
}

export default App
