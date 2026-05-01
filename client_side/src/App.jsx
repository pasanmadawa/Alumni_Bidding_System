import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import AuthTools from './pages/AuthTools.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import SignIn from './pages/SignIn.jsx'

function ClubIntro() {
  return (
    <section className="club-intro" aria-labelledby="club-title">
      <p className="intro-kicker">Alumni Club</p>
      <h2 id="club-title">Stay connected with your university community.</h2>
      <p>
        Alumni Club brings graduates, sponsors, and administrators together in one place.
        Members can keep their profile up to date, discover alumni opportunities, and support
        events that strengthen the network after graduation.
      </p>
      <p>
        Sign in to continue your journey, or create an account to join the community and start
        building meaningful professional connections.
      </p>
    </section>
  )
}

function AuthPage({ children }) {
  return (
    <main className="login-shell">
      <div className="auth-layout">
        {children}
        <ClubIntro />
      </div>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <AuthPage>
            <Login />
          </AuthPage>
        )}
      />
      <Route
        path="/signup"
        element={(
          <AuthPage>
            <SignIn />
          </AuthPage>
        )}
      />
      <Route
        path="/forgot-password"
        element={(
          <AuthPage>
            <AuthTools mode="forgot" />
          </AuthPage>
        )}
      />
      <Route
        path="/reset-password"
        element={(
          <AuthPage>
            <AuthTools mode="reset" />
          </AuthPage>
        )}
      />
      <Route
        path="/verify-email"
        element={(
          <AuthPage>
            <AuthTools mode="verify" />
          </AuthPage>
        )}
      />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/sign-in" element={<Navigate to="/login" replace />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
