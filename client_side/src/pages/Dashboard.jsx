import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { apiRequest, assetUrl, clearAuth, getStoredAuth, logoutRequest } from '../lib/api.js'

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

function TrendChart({ title, items }) {
  const max = Math.max(...(items || []).map((item) => item.count), 0)

  return (
    <section className="trend-chart">
      <h3>{title}</h3>
      {items && items.length > 0 ? (
        <div className="trend-bars">
          {items.map((item) => (
            <div className="trend-bar-row" key={item.label}>
              <span className="trend-label">{item.label}</span>
              <div className="trend-bar-track" aria-hidden="true">
                <span style={{ width: `${max ? (item.count / max) * 100 : 0}%` }} />
              </div>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No records match this filter yet.</p>
      )}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function ProfileDetail({ label, value, href }) {
  if (!hasValue(value)) return null

  return (
    <div className="profile-detail">
      <span>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">{value}</a>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  )
}

function profileInitials(profile, user) {
  const source = profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || user?.email || 'A'
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function collectionItemTitle(item) {
  return item.title || item.name || [item.company, item.role].filter(Boolean).join(' - ') || 'Profile item'
}

function collectionItemDetails(item) {
  return Object.entries(item)
    .filter(([key, value]) => !['id', 'profileId', 'createdAt', 'updatedAt'].includes(key) && hasValue(value))
    .map(([key, value]) => ({
      key,
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()),
      value: String(value).slice(0, 10),
    }))
}

function Dashboard({ view = 'home' }) {
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
  const [trendFilters, setTrendFilters] = useState({ programme: '', graduationDate: '' })
  const [trends, setTrends] = useState(null)
  const [alumni, setAlumni] = useState([])
  const [selectedAlumnus, setSelectedAlumnus] = useState(null)
  const [bidHistory, setBidHistory] = useState(null)
  const [featured, setFeatured] = useState(null)
  const [reveal, setReveal] = useState(null)
  const [bidStatus, setBidStatus] = useState(null)
  const [state, setState] = useState({ loading: false, message: '', error: '' })
  const [profileEditMode, setProfileEditMode] = useState(false)

  const role = authUser?.role || ''
  const canViewAlumni = role === 'SPONSOR' || role === 'ADMIN'
  const isAlumnus = role === 'ALUMNUS'
  const isAdmin = role === 'ADMIN'
  const isProfileView = view === 'profile'
  const isBidsView = view === 'bids'

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
      loadTrends()
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
      if (successMessage === null) {
        setState({ loading: false, message: '', error: '' })
      } else {
        setNotice(successMessage || result.message || 'Done.')
      }
      return result
    } catch (error) {
      setFailure(error)
      return null
    }
  }

  async function loadMe() {
    const result = await run(async () => apiRequest('/auth/me'), null)
    if (result?.user) {
      setAuthUser(result.user)
      localStorage.setItem('authUser', JSON.stringify(result.user))
    }

    const profileResult = await run(async () => apiRequest('/api/profile/me'), null)
    if (profileResult?.profile) {
      hydrateProfile(profileResult.profile)
      setAuthUser((current) => ({ ...(current || profileResult.user), profile: profileResult.profile }))
    }

    const completionResult = await run(async () => apiRequest('/api/profile/me/completion-status'), null)
    if (completionResult?.completionStatus) setCompletion(completionResult.completionStatus)
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
    }), 'Profile saved successfully.')
    if (result?.profile) {
      hydrateProfile(result.profile)
      setAuthUser((current) => ({ ...(current || {}), profile: result.profile }))
      setProfileEditMode(false)
    }
  }

  async function saveLinkedin(event) {
    event.preventDefault()
    const result = await run(async () => apiRequest('/api/profile/me/linkedin', {
      method: 'PATCH',
      body: JSON.stringify({ linkedinUrl: profile.linkedinUrl }),
    }), 'Profile saved successfully.')
    if (result?.profile) {
      hydrateProfile(result.profile)
      setAuthUser((current) => ({ ...(current || {}), profile: result.profile }))
      setProfileEditMode(false)
    }
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
    }), 'Profile saved successfully.')
    if (result?.profile) {
      hydrateProfile(result.profile)
      setAuthUser((current) => ({ ...(current || {}), profile: result.profile }))
      setProfileEditMode(false)
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('profileImage', file)
    const result = await run(async () => apiRequest('/api/profile/me/image', {
      method: 'POST',
      body: formData,
    }), 'Profile saved successfully.')
    if (result?.profileImage) setProfile((current) => ({ ...current, profileImage: result.profileImage }))
  }

  async function addCollectionItem(section) {
    const result = await run(async () => apiRequest(`/api/profile/me/${section}`, {
      method: 'POST',
      body: JSON.stringify(collections[section]),
    }), 'Profile saved successfully.')
    if (result) {
      setCollections((current) => ({ ...current, [section]: collectionTemplates[section] }))
      await loadMe()
      setNotice('Profile saved successfully.')
    }
  }

  async function updateCollectionItem(section, item) {
    await run(async () => apiRequest(`/api/profile/me/${section}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    }), 'Profile saved successfully.')
    await loadMe()
    setNotice('Profile saved successfully.')
  }

  async function deleteCollectionItem(section, itemId) {
    await run(async () => apiRequest(`/api/profile/me/${section}/${itemId}`, { method: 'DELETE' }), 'Profile saved successfully.')
    await loadMe()
    setNotice('Profile saved successfully.')
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

  async function loadTrends(filters = trendFilters) {
    const params = new URLSearchParams()

    if (filters.programme) params.set('programme', filters.programme)
    if (filters.graduationDate) params.set('graduationDate', filters.graduationDate)

    const query = params.toString() ? `?${params.toString()}` : ''
    const result = await run(async () => apiRequest(`/api/trends${query}`), 'Trends loaded.')
    if (result) setTrends(result)
  }

  async function applyTrendFilters(event) {
    event.preventDefault()
    await loadTrends(trendFilters)
  }

  async function clearTrendFilters() {
    const filters = { programme: '', graduationDate: '' }
    setTrendFilters(filters)
    await loadTrends(filters)
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
    if (result) setReveal(result)
  }

  const profileCollections = Object.keys(collectionTemplates).map((section) => ({
    section,
    label: collectionLabels[section],
    items: authUser?.profile?.[section] || [],
  }))
  const hasProfileSections = profileCollections.some((section) => section.items.length > 0)
  const hasProfileDetails = [
    profile.displayName,
    profile.contactNumber,
    profile.firstName,
    profile.lastName,
    profile.bio,
    profile.linkedinUrl,
    profile.profilePageUrl,
  ].some(hasValue)

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
          <nav className="dashboard-nav" aria-label="Dashboard navigation">
            <Link className={`dashboard-nav-link${isBidsView ? ' active' : ''}`} to="/bids">Bid</Link>
            <div className="profile-menu">
              <button
                type="button"
                className={`dashboard-nav-link profile-menu-button${isProfileView ? ' active' : ''}`}
                aria-haspopup="true"
              >
                Profile
              </button>
              <div className="profile-menu-list" role="menu">
                <Link className="profile-menu-item" to="/profile" role="menuitem">My profile</Link>
                <button type="button" className="profile-menu-item" onClick={handleLogout} role="menuitem">
                  Logout
                </button>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {isProfileView && state.message === 'Profile saved successfully.' && <Message state={state} />}

      <section className="dashboard-grid">
        {!isProfileView && !isBidsView && (
          <article className="panel wide trends-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Trends</p>
              <h2>View trends charts and graphs</h2>
            </div>
            <span className="metric-pill">{trends?.totals?.alumni || 0} alumni</span>
          </div>

          <form className="trend-filters" onSubmit={applyTrendFilters}>
            <Field label="Programme">
              <select
                value={trendFilters.programme}
                onChange={(event) => setTrendFilters((current) => ({ ...current, programme: event.target.value }))}
              >
                <option value="">All programmes</option>
                {(trends?.filters?.programmes || []).map((programmeOption) => (
                  <option key={programmeOption} value={programmeOption}>{programmeOption}</option>
                ))}
              </select>
            </Field>
            <Field label="Graduation date">
              <select
                value={trendFilters.graduationDate}
                onChange={(event) => setTrendFilters((current) => ({ ...current, graduationDate: event.target.value }))}
              >
                <option value="">All graduation dates</option>
                {(trends?.filters?.graduationDates || []).map((dateOption) => (
                  <option key={dateOption} value={dateOption}>{dateOption}</option>
                ))}
              </select>
            </Field>
            <div className="button-row trend-actions">
              <button type="submit">Apply filters</button>
              <button type="button" className="light-button" onClick={clearTrendFilters}>Clear</button>
            </div>
          </form>

          <div className="trend-grid">
            <TrendChart title="Curriculum skills gap" items={trends?.charts?.curriculumSkillsGap || []} />
            <TrendChart title="Employment by industry sector" items={trends?.charts?.employmentByIndustrySector || []} />
            <TrendChart title="Most common job titles" items={trends?.charts?.mostCommonJobTitles || []} />
            <TrendChart title="Top employers" items={trends?.charts?.topEmployers || []} />
            <TrendChart title="Geographic distribution" items={trends?.charts?.geographicDistribution || []} />
          </div>
          </article>
        )}

        {isProfileView && (
          <>
        <article className="panel wide profile-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Profile</p>
              <h2>My profile</h2>
            </div>
            <button type="button" className="secondary-button profile-edit-button" onClick={() => setProfileEditMode((current) => !current)}>
              {profileEditMode ? 'Close edit' : 'Edit profile'}
            </button>
          </div>

          {!profileEditMode ? (
            <div className="profile-overview">
              {profile.profileImage ? (
                <img className="profile-avatar" src={assetUrl(profile.profileImage)} alt="Profile" />
              ) : (
                <div className="profile-avatar profile-avatar-fallback" aria-label="Profile initials">
                  {profileInitials(profile, authUser)}
                </div>
              )}
              <div className="profile-summary">
                <h3>{profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || authUser?.email}</h3>
                <p>{authUser?.email} - {role}</p>
                {!hasProfileDetails && <p className="empty-state">No profile details added yet.</p>}
                <div className="profile-detail-grid">
                  <ProfileDetail label="First name" value={profile.firstName} />
                  <ProfileDetail label="Last name" value={profile.lastName} />
                  <ProfileDetail label="Contact number" value={profile.contactNumber} />
                  <ProfileDetail label="LinkedIn" value={profile.linkedinUrl} href={profile.linkedinUrl} />
                  <ProfileDetail label="Profile page" value={profile.profilePageUrl} href={profile.profilePageUrl} />
                </div>
                {hasValue(profile.bio) && (
                  <div className="profile-bio">
                    <span>Bio</span>
                    <p>{profile.bio}</p>
                  </div>
                )}
                {completion && (
                  <p className="status status-info profile-completion">
                    Completion: {completion.percentage}% ({completion.completedItems}/{completion.totalItems})
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </article>

        {isAlumnus && (
          <article className="panel wide">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Profile details</p>
                <h2>Education, courses, and employment</h2>
              </div>
            </div>

            {!profileEditMode ? (
              <div className="profile-section-list">
                {!hasProfileSections && <p className="empty-state">No education, courses, or employment details added yet.</p>}
                {profileCollections.map((section) => (
                  section.items.length > 0 && (
                    <section className="profile-section-group" key={section.section}>
                      <h3>{section.label}</h3>
                      <div className="profile-section-items">
                        {section.items.map((item) => (
                          <article className="profile-section-item" key={item.id}>
                            <h4>{collectionItemTitle(item)}</h4>
                            <div className="profile-section-meta">
                              {collectionItemDetails(item).map((detail) => (
                                <span key={detail.key}>{detail.label}: {detail.value}</span>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )
                ))}
              </div>
            ) : (
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
                        <span>{collectionItemTitle(item)}</span>
                        <div className="button-row compact-buttons">
                          <button type="button" onClick={() => updateCollectionItem(section, item)}>Update</button>
                          <button type="button" onClick={() => deleteCollectionItem(section, item.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </article>
        )}
        
          </>
        )}

        {isBidsView && (
          <>
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

          </>
        )}

        {isProfileView && canViewAlumni && (
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

        {isBidsView && isAdmin && (
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

      </section>
    </main>
  )
}

export default Dashboard
