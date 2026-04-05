(function () {
  const state = {
    accessToken: localStorage.getItem('accessToken') || '',
    refreshToken: localStorage.getItem('refreshToken') || ''
  };

  function setStatus(message, type) {
    const el = document.getElementById('auth-status');
    el.textContent = message;
    el.className = 'status ' + (type || 'info');
  }

  function showResponse(data, type) {
    const el = document.getElementById('auth-response');
    el.textContent = JSON.stringify(data, null, 2);
    el.className = 'status ' + (type || 'info');
  }

  function syncTokens() {
    localStorage.setItem('accessToken', state.accessToken || '');
    localStorage.setItem('refreshToken', state.refreshToken || '');
    document.getElementById('access-token').textContent = state.accessToken || 'Not set';
    document.getElementById('refresh-token').textContent = state.refreshToken || 'Not set';
  }

  async function api(path, options) {
    const headers = Object.assign({}, options && options.headers ? options.headers : {});

    if (!headers['Content-Type'] && !(options && options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (state.accessToken) {
      headers.Authorization = 'Bearer ' + state.accessToken;
    }

    const response = await fetch(path, {
      method: options && options.method ? options.method : 'GET',
      headers: headers,
      body: options && options.body !== undefined
        ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
        : undefined,
      credentials: 'include'
    });

    const data = await response.json().catch(function () {
      return { message: 'Non-JSON response' };
    });

    if (!response.ok) {
      throw data;
    }

    return data;
  }

  document.getElementById('register-button').addEventListener('click', async function () {
    try {
      setStatus('Registering user...', 'info');
      const data = await api('/auth/register', {
        method: 'POST',
        body: {
          role: document.getElementById('register-role').value,
          email: document.getElementById('register-email').value,
          password: document.getElementById('register-password').value,
          firstName: document.getElementById('register-first-name').value,
          lastName: document.getElementById('register-last-name').value
        }
      });
      if (data.devVerificationToken) {
        document.getElementById('verify-token').value = data.devVerificationToken;
      }
      setStatus('Registration completed. Verify the email next.', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Registration failed', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('verify-button').addEventListener('click', async function () {
    try {
      setStatus('Verifying email...', 'info');
      const data = await api('/auth/verify-email', {
        method: 'POST',
        body: {
          token: document.getElementById('verify-token').value
        }
      });
      setStatus('Email verified successfully', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Verification failed', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('login-button').addEventListener('click', async function () {
    try {
      setStatus('Logging in...', 'info');
      const data = await api('/auth/login', {
        method: 'POST',
        body: {
          role: document.getElementById('login-role').value,
          email: document.getElementById('login-email').value,
          password: document.getElementById('login-password').value
        }
      });
      state.accessToken = data.accessToken || '';
      state.refreshToken = data.refreshToken || '';
      syncTokens();
      setStatus('Login successful', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Login failed', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('me-button').addEventListener('click', async function () {
    try {
      const data = await api('/auth/me');
      setStatus('Fetched logged-in user', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Failed to fetch /auth/me', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('forgot-button').addEventListener('click', async function () {
    try {
      setStatus('Requesting reset token...', 'info');
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        body: {
          email: document.getElementById('forgot-email').value
        }
      });
      if (data.devResetToken) {
        document.getElementById('reset-token').value = data.devResetToken;
      }
      setStatus('Password reset request completed', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Password reset request failed', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('reset-button').addEventListener('click', async function () {
    try {
      setStatus('Resetting password...', 'info');
      const data = await api('/auth/reset-password', {
        method: 'POST',
        body: {
          token: document.getElementById('reset-token').value,
          newPassword: document.getElementById('reset-password').value
        }
      });
      setStatus('Password reset successful', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Password reset failed', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('refresh-button').addEventListener('click', async function () {
    try {
      const data = await api('/auth/refresh', {
        method: 'POST',
        body: {
          refreshToken: state.refreshToken
        }
      });
      state.accessToken = data.accessToken || state.accessToken;
      state.refreshToken = data.refreshToken || state.refreshToken;
      syncTokens();
      setStatus('Token refreshed', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Token refresh failed', 'error');
      showResponse(error, 'error');
    }
  });

  document.getElementById('logout-button').addEventListener('click', async function () {
    try {
      const data = await api('/auth/logout', {
        method: 'POST',
        body: {
          refreshToken: state.refreshToken
        }
      });
      state.accessToken = '';
      state.refreshToken = '';
      syncTokens();
      setStatus('Logged out', 'success');
      showResponse(data, 'success');
    } catch (error) {
      setStatus('Logout failed', 'error');
      showResponse(error, 'error');
    }
  });

  syncTokens();
})();
