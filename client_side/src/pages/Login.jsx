import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api.js'
import OtpDialog from '../components/OtpDialog.jsx'

function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [authState, setAuthState] = useState({
    loading: false,
    message: location.state?.message || '',
    error: '',
    user: JSON.parse(localStorage.getItem('authUser') || 'null'),
  })
  const [otpState, setOtpState] = useState({
    open: false,
    loading: false,
    challengeId: '',
    otp: '',
    devOtp: '',
    error: '',
  })

  useEffect(() => {
    if (authState.user) {
      navigate('/dashboard', { replace: true })
    }
  }, [authState.user, navigate])

  function updateField(event) {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setAuthState({
      loading: true,
      message: '',
      error: '',
      user: null,
    })

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Login failed. Please check your details.')
      }

      if (result.requiresOtp) {
        setOtpState({
          open: true,
          loading: false,
          challengeId: result.challengeId,
          otp: '',
          devOtp: result.devOtp || '',
          error: '',
        })

        setAuthState({
          loading: false,
          message: result.message || 'OTP sent to your email.',
          error: '',
          user: null,
        })
        return
      }

      completeLogin(result)
    } catch (error) {
      setAuthState({
        loading: false,
        message: '',
        error: error.message,
        user: null,
      })
    }
  }

  function completeLogin(result) {
    localStorage.setItem('accessToken', result.accessToken)
    localStorage.setItem('refreshToken', result.refreshToken)
    localStorage.setItem('authUser', JSON.stringify(result.user))

    setAuthState({
      loading: false,
      message: result.message || 'Login successful.',
      error: '',
      user: result.user,
    })

    navigate('/dashboard')
  }

  async function handleOtpSubmit(event) {
    event.preventDefault()

    setOtpState((current) => ({ ...current, loading: true, error: '' }))

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          challengeId: otpState.challengeId,
          otp: otpState.otp,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'OTP verification failed.')
      }

      setOtpState({
        open: false,
        loading: false,
        challengeId: '',
        otp: '',
        devOtp: '',
        error: '',
      })
      completeLogin(result)
    } catch (error) {
      setOtpState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }))
    }
  }

  function handleLogout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('authUser')

    setAuthState({
      loading: false,
      message: 'Logged out from this browser.',
      error: '',
      user: null,
    })
  }

  return (
    <section className="login-panel" aria-labelledby="login-title">
      <div className="brand-block">
        <img className="brand-mark" src="/logo.png" alt="Alumni Club logo" />
        <div>
          <h1 id="login-title">Login</h1>
          <p>Welcome back to Alumni Club.</p>
        </div>
      </div>

      <nav className="auth-tabs" aria-label="Authentication pages">
        <Link className="auth-tab active" to="/login">Login</Link>
        <Link className="auth-tab" to="/signup">Sign up</Link>
      </nav>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          Email address
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={updateField}
            placeholder="student@westminster.ac.uk"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <span className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={updateField}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>

        <button type="submit" disabled={authState.loading}>
          {authState.loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/verify-email">Verify email</Link>
      </div>

      {authState.error && (
        <p className="status status-error" role="alert">
          {authState.error}
        </p>
      )}

      {authState.message && (
        <p className="status status-success">
          {authState.message}
        </p>
      )}

      {authState.user && (
        <div className="session-actions">
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}

      {otpState.open && (
        <OtpDialog
          title="Enter login OTP"
          description="We sent a 6-digit code to your email address."
          otp={otpState.otp}
          devOtp={otpState.devOtp}
          loading={otpState.loading}
          error={otpState.error}
          onChange={(event) => setOtpState((current) => ({ ...current, otp: event.target.value }))}
          onClose={() => setOtpState((current) => ({ ...current, open: false }))}
          onSubmit={handleOtpSubmit}
        />
      )}
    </section>
  )
}

export default Login
