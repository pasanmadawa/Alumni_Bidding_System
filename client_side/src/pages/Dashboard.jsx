import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { apiRequest, assetUrl, clearAuth, getStoredAuth, logoutRequest, saveAuth } from '../lib/api.js'

const emptyProfile = {
  displayName: '',
  firstName: '',
  lastName: '',
  bio: '',
  contactNumber: '',
  linkedinUrl: '',
  profilePageUrl: '',
}

const collectionTemplates = {
  degrees: { title: '', institutionUrl: '', completionDate: '' },
  certifications: { name: '', issuerUrl: '', completionDate: '' },
  licences: { name: '', issuerUrl: '', completionDate: '' },
  courses: { name: '', courseUrl: '', completionDate: '' },
  employment: { company: '', role: '', startDate: '', endDate: '' },
}

const collectionLabels = {
  degrees: 'Degrees',
  certifications: 'Certifications',
  licences: 'Licences',
  courses: 'Courses',
  employment: 'Employment',
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function compactBody(body) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined))
}

function Message({ state }) {
  if (!state.error && !state.message) return null
  return (
    <>
      {state.error && <p className="status status-error" role="alert">{state.error}</p>}
      {state.message && <p className="status status-success">{state.message}</p>}
    </>
  )
}

function JsonBlock({ data }) {
  if (!data) return null
  return <pre className="json-output">{JSON.stringify(data, null, 2)}</pre>
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Dashboard() {
  const navigate = useNavigate()
  const stored = getStoredAuth()
  const [authUser, setAuthUser] = useState(stored.user)
  const [profile, setProfile] = useState(emptyProfile)
  const [collections, setCollections] = useState(collectionTemplates)
  const [completion, setCompletion] = useState(null)
  const [featuredDate, setFeaturedDate] = useState(dateOnly(new Date()))
  const [bidForm, setBidForm] = useState({ targetFeaturedDate: dateOnly(new Date()), amount: '' })
  const [adminWinnerDate, setAdminWinnerDate] = useState('')
  const [creditForm, setCreditForm] = useState({
    userId: '',
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    extraWinsAllowed: '1',
  })
  const [legacyForm, setLegacyForm] = useState({ userId: '0', userName: '', petId: '0', petName: '' })
  const [alumni, setAlumni] = useState([])
  const [selectedAlumnus, setSelectedAlumnus] = useState(null)
  const [bidHistory, setBidHistory] = useState(null)
  const [featured, setFeatured] = useState(null)
  const [reveal, setReveal] = useState(null)
  const [bidStatus, setBidStatus] = useState(null)
  const [legacyResult, setLegacyResult] = useState(null)
  const [state, setState] = useState({ loading: false, message: '', error: '' })

  const role = authUser?.role || ''
  const canViewAlumni = role === 'SPONSOR' || role === 'ADMIN'
  const isAlumnus = role === 'ALUMNUS'
  const isAdmin = role === 'ADMIN'

  const profilePayload = useMemo(() => compactBody({
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    bio: profile.bio,
    contactNumber: profile.contactNumber,
    linkedinUrl: profile.linkedinUrl,
    profilePageUrl: profile.profilePageUrl,
  }), [profile])

  useEffect(() => {
    if (stored.accessToken) {
      loadMe()
      loadFeatured()
    }
    // Load the dashboard once from browser auth storage when the route opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!stored.accessToken) {
    return <Navigate to="/login" replace />
  }

  function setNotice(message) {
    setState({ loading: false, message, error: '' })
  }

  function setFailure(error) {
    if (error.status === 401) {
      clearAuth()
      navigate('/login', { replace: true, state: { message: 'Session expired. Please sign in again.' } })
      return
    }
    setState({ loading: false, message: '', error: error.message })
  }

  function hydrateProfile(nextProfile) {
    const next = nextProfile || {}
    setProfile({
      displayName: next.displayName || '',
      firstName: next.firstName || '',
      lastName: next.lastName || '',
      bio: next.bio || '',
      contactNumber: next.contactNumber || '',
      linkedinUrl: next.linkedinUrl || '',
      profilePageUrl: next.profilePageUrl || '',
      profileImage: next.profileImage || '',
    })
  }

  async function run(action, successMessage) {
    setState({ loading: true, message: '', error: '' })
    try {
      const result = await action()
      setNotice(successMessage || result.message || 'Done.')
      return result
    } catch (error) {
      setFailure(error)
      return null
    }
  }

  async function loadMe() {
    const result = await run(async () => apiRequest('/auth/me'), 'Account loaded.')
    if (result?.user) {
      setAuthUser(result.user)
      localStorage.setItem('authUser', JSON.stringify(result.user))
    }

    const profileResult = await run(async () => apiRequest('/api/profile/me'), 'Profile loaded.')
    if (profileResult?.profile) {
      hydrateProfile(profileResult.profile)
      setAuthUser((current) => ({ ...(current || profileResult.user), profile: profileResult.profile }))
    }

    const completionResult = await run(async () => apiRequest('/api/profile/me/completion-status'), 'Profile status loaded.')
    if (completionResult?.completionStatus) setCompletion(completionResult.completionStatus)
  }

  async function handleRefreshToken() {
    const { refreshToken } = getStoredAuth()
    const result = await run(async () => apiRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }), 'Token refreshed.')
    if (result) saveAuth(result)
  }

  async function handleLogout() {
    await logoutRequest()
    navigate('/login', { replace: true, state: { message: 'Logged out successfully.' } })
  }

  async function saveBasicProfile(event) {
    event.preventDefault()
    const result = await run(async () => apiRequest('/api/profile/me/basic', {
      method: 'PATCH',
      body: JSON.stringify(profilePayload),
    }))
    if (result?.profile) hydrateProfile(result.profile)
  }

  async function saveLinkedin(event) {
    event.preventDefault()
    const result = await run(async () => apiRequest('/api/profile/me/linkedin', {
      method: 'PATCH',
      body: JSON.stringify({ linkedinUrl: profile.linkedinUrl }),
    }))
    if (result?.profile) hydrateProfile(result.profile)
  }

  async function saveFullProfile() {
    const result = await run(async () => apiRequest('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify({
        ...profilePayload,
        degrees: [],
        certifications: [],
        licences: [],
        courses: [],
        employment: [],
      }),
    }))
    if (result?.profile) hydrateProfile(result.profile)
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('profileImage', file)
    const result = await run(async () => apiRequest('/api/profile/me/image', {
      method: 'POST',
      body: formData,
    }))
    if (result?.profileImage) setProfile((current) => ({ ...current, profileImage: result.profileImage }))
  }

  async function addCollectionItem(section) {
    const result = await run(async () => apiRequest(`/api/profile/me/${section}`, {
      method: 'POST',
      body: JSON.stringify(collections[section]),
    }))
    if (result) {
      setCollections((current) => ({ ...current, [section]: collectionTemplates[section] }))
      await loadMe()
    }
  }

  async function updateCollectionItem(section, item) {
    await run(async () => apiRequest(`/api/profile/me/${section}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    }))
    await loadMe()
  }

  async function deleteCollectionItem(section, itemId) {
    await run(async () => apiRequest(`/api/profile/me/${section}/${itemId}`, { method: 'DELETE' }))
    await loadMe()
  }

  async function loadFeatured() {
    const query = featuredDate ? `?targetFeaturedDate=${featuredDate}` : ''
    const result = await run(async () => apiRequest(`/api/bids/featured/current${query}`), 'Featured profile loaded.')
    if (result) setFeatured(result)
  }

  async function loadReveal() {
    const query = featuredDate ? `?targetFeaturedDate=${featuredDate}` : ''
    const result = await run(async () => apiRequest(`/api/bids/reveal/current${query}`), 'Bid reveal loaded.')
    if (result) setReveal(result)
  }

  async function loadBidStatus() {
    const result = await run(async () => apiRequest(`/api/bids/me?targetFeaturedDate=${bidForm.targetFeaturedDate}`), 'Bid status loaded.')
    if (result) setBidStatus(result)
  }

  async function placeBid(event) {
    event.preventDefault()
    const result = await run(async () => apiRequest('/api/bids/me', {
      method: 'POST',
      body: JSON.stringify(bidForm),
    }))
    if (result) setBidStatus(result)
  }

  async function increaseBid() {
    const result = await run(async () => apiRequest('/api/bids/me/increase', {
      method: 'PUT',
      body: JSON.stringify(bidForm),
    }))
    if (result) setBidStatus(result)
  }

  async function cancelBid() {
    const result = await run(async () => apiRequest(`/api/bids/me?targetFeaturedDate=${bidForm.targetFeaturedDate}`, { method: 'DELETE' }))
    if (result) setBidStatus(result)
  }

  async function loadBidHistory() {
    const result = await run(async () => apiRequest('/api/bids/history'), 'Bid history loaded.')
    if (result) setBidHistory(result)
  }

  async function loadAlumni() {
    const result = await run(async () => apiRequest('/api/alumni'), 'Alumni loaded.')
    if (result?.alumni) setAlumni(result.alumni)
  }

  async function loadAlumnus(userId) {
    const result = await run(async () => apiRequest(`/api/alumni/${userId}`), 'Alumnus loaded.')
    if (result?.alumnus) setSelectedAlumnus(result.alumnus)
  }

  async function deleteAlumnus(userId) {
    await run(async () => apiRequest(`/api/alumni/${userId}`, { method: 'DELETE' }))
    setSelectedAlumnus(null)
    await loadAlumni()
  }

  async function selectWinner(event) {
    event.preventDefault()
    const result = await run(async () => apiRequest('/api/bids/select-winner', {
      method: 'POST',
      body: JSON.stringify(adminWinnerDate ? { targetFeaturedDate: adminWinnerDate } : {}),
    }))
    if (result) setReveal(result)
  }

  async function addEventCredit(event) {
    event.preventDefault()
    const result = await run(async () => apiRequest('/api/bids/event-credit', {
      method: 'POST',
      body: JSON.stringify(creditForm),
    }))
    if (result) setLegacyResult(result)
  }

  async function runLegacy(path, options, message) {
    const result = await run(async () => apiRequest(path, options), message)
    if (result) setLegacyResult(result)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block compact">
          <img className="brand-mark" src="/logo.png" alt="Alumni Club logo" />
          <div>
            <h1>Alumni Club</h1>
            <p>{authUser?.email} · {role}</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={handleRefreshToken}>Refresh token</button>
          <button type="button" className="secondary-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <Message state={state} />

      <section className="dashboard-grid">
        <article className="panel wide">
          <h2>My profile</h2>
          <form className="dashboard-form" onSubmit={saveBasicProfile}>
            <div className="form-row">
              <Field label="Display name">
                <input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} />
              </Field>
              <Field label="Contact number">
                <input value={profile.contactNumber} onChange={(event) => setProfile({ ...profile, contactNumber: event.target.value })} />
              </Field>
            </div>
            {isAlumnus && (
              <div className="form-row">
                <Field label="First name">
                  <input value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} />
                </Field>
                <Field label="Last name">
                  <input value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} />
                </Field>
              </div>
            )}
            <Field label="Bio">
              <textarea value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="LinkedIn URL">
                <input value={profile.linkedinUrl} onChange={(event) => setProfile({ ...profile, linkedinUrl: event.target.value })} />
              </Field>
              <Field label="Profile page URL">
                <input value={profile.profilePageUrl} onChange={(event) => setProfile({ ...profile, profilePageUrl: event.target.value })} />
              </Field>
            </div>
            <div className="button-row">
              <button type="submit">Save basic profile</button>
              <button type="button" onClick={saveLinkedin}>Save LinkedIn only</button>
              <button type="button" onClick={saveFullProfile}>Save full profile</button>
            </div>
          </form>
          <div className="image-row">
            {profile.profileImage && <img className="profile-preview" src={assetUrl(profile.profileImage)} alt="Profile" />}
            <Field label="Profile image">
              <input type="file" accept="image/*" onChange={uploadImage} />
            </Field>
          </div>
          {completion && (
            <p className="status status-info">
              Completion: {completion.percentage}% ({completion.completedItems}/{completion.totalItems})
            </p>
          )}
        </article>

        {isAlumnus && (
          <article className="panel wide">
            <h2>Profile sections</h2>
            <div className="collection-grid">
              {Object.keys(collectionTemplates).map((section) => (
                <section className="mini-panel" key={section}>
                  <h3>{collectionLabels[section]}</h3>
                  <div className="dashboard-form">
                    {Object.keys(collectionTemplates[section]).map((key) => (
                      <Field key={key} label={key}>
                        <input
                          type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                          value={collections[section][key]}
                          onChange={(event) => setCollections((current) => ({
                            ...current,
                            [section]: { ...current[section], [key]: event.target.value },
                          }))}
                        />
                      </Field>
                    ))}
                    <button type="button" onClick={() => addCollectionItem(section)}>Add {collectionLabels[section]}</button>
                  </div>
                  {(authUser?.profile?.[section] || []).map((item) => (
                    <div className="list-item" key={item.id}>
                      <span>{item.title || item.name || `${item.company} · ${item.role}`}</span>
                      <div className="button-row compact-buttons">
                        <button type="button" onClick={() => updateCollectionItem(section, item)}>Update</button>
                        <button type="button" onClick={() => deleteCollectionItem(section, item.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </article>
        )}

        <article className="panel">
          <h2>Featured alumni</h2>
          <div className="dashboard-form">
            <Field label="Featured date">
              <input type="date" value={featuredDate} onChange={(event) => setFeaturedDate(event.target.value)} />
            </Field>
            <div className="button-row">
              <button type="button" onClick={loadFeatured}>Public featured</button>
              <button type="button" onClick={loadReveal}>Reveal winner</button>
            </div>
          </div>
          <JsonBlock data={featured || reveal} />
        </article>

        {isAlumnus && (
          <article className="panel">
            <h2>My bids</h2>
            <form className="dashboard-form" onSubmit={placeBid}>
              <Field label="Target featured date">
                <input type="date" value={bidForm.targetFeaturedDate} onChange={(event) => setBidForm({ ...bidForm, targetFeaturedDate: event.target.value })} required />
              </Field>
              <Field label="Amount">
                <input value={bidForm.amount} onChange={(event) => setBidForm({ ...bidForm, amount: event.target.value })} placeholder="100.00" required />
              </Field>
              <div className="button-row">
                <button type="submit">Place bid</button>
                <button type="button" onClick={increaseBid}>Increase bid</button>
                <button type="button" onClick={cancelBid}>Cancel bid</button>
                <button type="button" onClick={loadBidStatus}>Status</button>
                <button type="button" onClick={loadBidHistory}>History</button>
              </div>
            </form>
            <JsonBlock data={bidStatus || bidHistory} />
          </article>
        )}

        {canViewAlumni && (
          <article className="panel wide">
            <h2>Alumni directory</h2>
            <button type="button" onClick={loadAlumni}>Load alumni</button>
            <div className="directory">
              {alumni.map((item) => (
                <div className="list-item" key={item.id}>
                  <span>{item.profile?.firstName || item.profile?.displayName || item.email}</span>
                  <div className="button-row compact-buttons">
                    <button type="button" onClick={() => loadAlumnus(item.id)}>View</button>
                    {isAdmin && <button type="button" onClick={() => deleteAlumnus(item.id)}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
            <JsonBlock data={selectedAlumnus} />
          </article>
        )}

        {isAdmin && (
          <article className="panel wide">
            <h2>Admin bidding</h2>
            <form className="dashboard-form" onSubmit={selectWinner}>
              <Field label="Winner date">
                <input type="date" value={adminWinnerDate} onChange={(event) => setAdminWinnerDate(event.target.value)} />
              </Field>
              <button type="submit">Select winner</button>
            </form>
            <form className="dashboard-form" onSubmit={addEventCredit}>
              <div className="form-row">
                <Field label="Alumnus user ID">
                  <input value={creditForm.userId} onChange={(event) => setCreditForm({ ...creditForm, userId: event.target.value })} required />
                </Field>
                <Field label="Extra wins">
                  <input value={creditForm.extraWinsAllowed} onChange={(event) => setCreditForm({ ...creditForm, extraWinsAllowed: event.target.value })} required />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Year">
                  <input value={creditForm.year} onChange={(event) => setCreditForm({ ...creditForm, year: event.target.value })} required />
                </Field>
                <Field label="Month">
                  <input value={creditForm.month} onChange={(event) => setCreditForm({ ...creditForm, month: event.target.value })} required />
                </Field>
              </div>
              <button type="submit">Save event credit</button>
            </form>
          </article>
        )}

        <article className="panel wide">
          <h2>Legacy demo API</h2>
          <div className="dashboard-form">
            <div className="button-row">
              <button type="button" onClick={() => runLegacy('/', undefined, 'API index loaded.')}>API index</button>
              <button type="button" onClick={() => runLegacy('/users', undefined, 'Users loaded.')}>List users</button>
            </div>
            <div className="form-row">
              <Field label="User ID">
                <input value={legacyForm.userId} onChange={(event) => setLegacyForm({ ...legacyForm, userId: event.target.value })} />
              </Field>
              <Field label="User name">
                <input value={legacyForm.userName} onChange={(event) => setLegacyForm({ ...legacyForm, userName: event.target.value })} />
              </Field>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => runLegacy(`/user/${legacyForm.userId}`, undefined, 'User loaded.')}>Get user</button>
              <button type="button" onClick={() => runLegacy(`/user/${legacyForm.userId}`, {
                method: 'PUT',
                body: JSON.stringify({ name: legacyForm.userName }),
              })}>Update user</button>
              <button type="button" onClick={() => runLegacy(`/user/${legacyForm.userId}/pet`, {
                method: 'POST',
                body: JSON.stringify({ name: legacyForm.petName }),
              })}>Create pet</button>
            </div>
            <div className="form-row">
              <Field label="Pet ID">
                <input value={legacyForm.petId} onChange={(event) => setLegacyForm({ ...legacyForm, petId: event.target.value })} />
              </Field>
              <Field label="Pet name">
                <input value={legacyForm.petName} onChange={(event) => setLegacyForm({ ...legacyForm, petName: event.target.value })} />
              </Field>
            </div>
            <div className="button-row">
              <button type="button" onClick={() => runLegacy(`/pet/${legacyForm.petId}`, undefined, 'Pet loaded.')}>Get pet</button>
              <button type="button" onClick={() => runLegacy(`/pet/${legacyForm.petId}`, {
                method: 'PUT',
                body: JSON.stringify({ name: legacyForm.petName }),
              })}>Update pet</button>
            </div>
          </div>
          <JsonBlock data={legacyResult} />
        </article>
      </section>
    </main>
  )
}

export default Dashboard
