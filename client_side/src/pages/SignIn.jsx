import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api.js'

const roleOptions = [
  { value: 'ALUMNUS', label: 'Alumnus' },
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
  const [authState, setAuthState] = useState({
    loading: false,
    message: '',
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
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Sign up failed. Please check your details.')
      }

      navigate('/login', {
        state: {
          message: result.message || 'Registration successful. Please verify your email.',
        },
      })
    } catch (error) {
      setAuthState({
        loading: false,
        message: '',
        error: error.message,
      })
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
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={updateField}
            placeholder="Enter your password"
            autoComplete="new-password"
            required
          />
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
    </section>
  )
}

export default SignIn
