import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api.js'
import OtpDialog from '../components/OtpDialog.jsx'

const roleOptions = [
  { value: 'ALUMNUS', label: 'Alumnus' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'SPONSOR', label: 'Sponsor' },
]

function SignIn() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'ALUMNUS',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [authState, setAuthState] = useState({
    loading: false,
    message: '',
    error: '',
  })
  const [otpState, setOtpState] = useState({
    open: false,
    loading: false,
    otp: '',
    devOtp: '',
    error: '',
  })

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
    })

    try {
      const payload = {
        ...formData,
        firstName: formData.role === 'ALUMNUS' ? formData.firstName : '',
        lastName: formData.role === 'ALUMNUS' ? formData.lastName : '',
      }
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Sign up failed. Please check your details.')
      }

      setOtpState({
        open: true,
        loading: false,
        otp: '',
        devOtp: result.devVerificationToken || '',
        error: '',
      })
      setAuthState({
        loading: false,
        message: result.message || 'Registration successful. Please verify your email.',
        error: '',
      })
    } catch (error) {
      setAuthState({
        loading: false,
        message: '',
        error: error.message,
      })
    }
  }

  async function handleOtpSubmit(event) {
    event.preventDefault()

    setOtpState((current) => ({ ...current, loading: true, error: '' }))

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: otpState.otp }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'OTP verification failed.')
      }

      navigate('/login', {
        state: {
          message: result.message || 'Email verified. You can sign in now.',
        },
      })
    } catch (error) {
      setOtpState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }))
    }
  }

  return (
    <section className="login-panel" aria-labelledby="signup-title">
      <div className="brand-block">
        <img className="brand-mark" src="/logo.png" alt="Alumni Club logo" />
        <div>
          <h1 id="signup-title">Sign up</h1>
          <p>Create your Alumni Club account.</p>
        </div>
      </div>

      <nav className="auth-tabs" aria-label="Authentication pages">
        <Link className="auth-tab" to="/login">Login</Link>
        <Link className="auth-tab active" to="/signup">Sign up</Link>
      </nav>

      <form className="login-form" onSubmit={handleSubmit}>
        {formData.role === 'ALUMNUS' && (
          <div className="form-row">
            <label>
              First name
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={updateField}
                placeholder="Madawa"
                autoComplete="given-name"
                required
              />
            </label>

            <label>
              Last name
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={updateField}
                placeholder="Wijesinghe"
                autoComplete="family-name"
                required
              />
            </label>
          </div>
        )}

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
              autoComplete="new-password"
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

        <label>
          Account type
          <select name="role" value={formData.role} onChange={updateField}>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={authState.loading}>
          {authState.loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

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

      {otpState.open && (
        <OtpDialog
          title="Enter signup OTP"
          description="We sent a 6-digit verification code to your email address."
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

export default SignIn
