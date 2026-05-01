import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import OtpDialog from '../components/OtpDialog.jsx'
import { apiRequest } from '../lib/api.js'

function AuthTools({ mode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const [formData, setFormData] = useState({
    email: '',
    token: params.get('token') || '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [state, setState] = useState({ loading: false, message: '', error: '', devToken: '' })
  const [otpState, setOtpState] = useState({
    open: false,
    loading: false,
    otp: '',
    devOtp: '',
    error: '',
  })

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      token: new URLSearchParams(location.search).get('token') || '',
    }))
  }, [location.search])

  const copy = {
    forgot: {
      title: 'Forgot password',
      intro: 'Request a password reset OTP.',
      button: 'Send OTP',
    },
    reset: {
      title: 'Reset password',
      intro: 'Create a new password for your account.',
      button: 'Change password',
    },
    verify: {
      title: 'Verify email',
      intro: 'Paste the verification token from your email.',
      button: 'Verify email',
    },
  }[mode]

  function updateField(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setState({ loading: true, message: '', error: '', devToken: '' })

    try {
      const endpoint = mode === 'forgot'
        ? '/auth/forgot-password'
        : mode === 'reset'
          ? '/auth/reset-password'
          : '/auth/verify-email'
      const body = mode === 'forgot'
        ? { email: formData.email }
        : mode === 'reset'
          ? { token: formData.token, newPassword: formData.newPassword }
          : { token: formData.token }

      if (mode === 'reset' && formData.newPassword !== formData.confirmPassword) {
        throw new Error('New password and confirm password do not match.')
      }

      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (mode === 'forgot') {
        setOtpState({
          open: true,
          loading: false,
          otp: '',
          devOtp: result.devResetToken || '',
          error: '',
        })
      }

      setState({
        loading: false,
        message: mode === 'reset'
          ? 'Successfully changed the password. Redirecting to login...'
          : result.message || 'Request completed successfully.',
        error: '',
        devToken: result.devResetToken || result.devVerificationToken || '',
      })

      if (mode === 'reset') {
        setTimeout(() => navigate('/login', { state: { message: 'Successfully changed the password. Please log in.' } }), 1200)
      } else if (mode === 'verify') {
        setTimeout(() => navigate('/login', { state: { message: 'Email verified. You can sign in now.' } }), 800)
      }
    } catch (error) {
      setState({ loading: false, message: '', error: error.message, devToken: '' })
    }
  }

  async function handleOtpSubmit(event) {
    event.preventDefault()
    setOtpState((current) => ({ ...current, loading: true, error: '' }))

    try {
      const result = await apiRequest('/auth/reset-password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ token: otpState.otp }),
      })

      setOtpState({
        open: false,
        loading: false,
        otp: '',
        devOtp: '',
        error: '',
      })
      setState({
        loading: false,
        message: result.message || 'OTP verified.',
        error: '',
        devToken: '',
      })
      navigate(`/reset-password?token=${encodeURIComponent(otpState.otp)}`)
    } catch (error) {
      setOtpState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }))
    }
  }

  return (
    <section className="login-panel" aria-labelledby={`${mode}-title`}>
      <div className="brand-block">
        <img className="brand-mark" src="/logo.png" alt="Alumni Club logo" />
        <div>
          <h1 id={`${mode}-title`}>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        {mode === 'forgot' && (
          <label>
            Email address
            <input type="email" name="email" value={formData.email} onChange={updateField} required />
          </label>
        )}

        {mode === 'verify' && (
          <label>
            Token
            <input type="text" name="token" value={formData.token} onChange={updateField} required />
          </label>
        )}

        {mode === 'reset' && (
          <>
            <label>
              New password
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={updateField}
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
              Confirm password
              <span className="password-field">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={updateField}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
          </>
        )}

        <button type="submit" disabled={state.loading}>
          {state.loading ? 'Working...' : copy.button}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/login">Back to login</Link>
      </div>

      {state.error && <p className="status status-error" role="alert">{state.error}</p>}
      {state.message && <p className="status status-success">{state.message}</p>}
      {mode !== 'forgot' && state.devToken && <p className="status status-info">Development token: {state.devToken}</p>}

      {otpState.open && (
        <OtpDialog
          title="Enter reset OTP"
          description="We sent a 6-digit password reset code to your email address."
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

export default AuthTools
