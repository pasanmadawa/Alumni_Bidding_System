import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api.js'

function AuthTools({ mode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const [formData, setFormData] = useState({
    email: '',
    token: params.get('token') || '',
    newPassword: '',
  })
  const [state, setState] = useState({ loading: false, message: '', error: '', devToken: '' })

  const copy = {
    forgot: {
      title: 'Forgot password',
      intro: 'Request a password reset token.',
      button: 'Send reset token',
    },
    reset: {
      title: 'Reset password',
      intro: 'Use your reset token to set a new password.',
      button: 'Reset password',
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
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      setState({
        loading: false,
        message: result.message || 'Request completed successfully.',
        error: '',
        devToken: result.devResetToken || result.devVerificationToken || '',
      })

      if (mode === 'verify') {
        setTimeout(() => navigate('/login', { state: { message: 'Email verified. You can sign in now.' } }), 800)
      }
    } catch (error) {
      setState({ loading: false, message: '', error: error.message, devToken: '' })
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

        {mode !== 'forgot' && (
          <label>
            Token
            <input type="text" name="token" value={formData.token} onChange={updateField} required />
          </label>
        )}

        {mode === 'reset' && (
          <label>
            New password
            <input type="password" name="newPassword" value={formData.newPassword} onChange={updateField} required />
          </label>
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
      {state.devToken && <p className="status status-info">Development token: {state.devToken}</p>}
    </section>
  )
}

export default AuthTools
