import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { apiRequest, assetUrl, clearAuth, getStoredAuth, logoutRequest } from '../lib/api.js'

const IIT_INSTITUTION_NAME = 'Informatics Institute of Technology, Sri Lanka'
const degreeProgrammes = [
  'BSc (Hons) Business Computing',
  'BEng (Hons) Software Engineering',
  'BSc (Hons) Computer Science',
  'BSc (Hons) Artificial Intelligence And Data Science',
  'BSc (Hons) Business Data Analytics',
  'BA (Hons) Business Management',
  'MSc Applied Artificial Intelligence',
  'MA Fashion Business Management',
  'MSc Business Analytics',
  'MSc Information Technology',
  'MSc Big Data Analytics',
  'MSc Cyber Security And Forensics',
  'MSc Advanced Software Engineering',
]

const emptyProfile = {
  displayName: '',
  firstName: '',
  lastName: '',
  bio: '',
  contactNumber: '',
  linkedinUrl: '',
}

const collectionTemplates = {
  specialisedAreas: { name: '' },
  degrees: { title: '', institutionName: IIT_INSTITUTION_NAME, degreeUrl: '', completionDate: '' },
  certifications: { name: '', issuerUrl: '', completionDate: '' },
  licences: { name: '', issuerUrl: '', completionDate: '' },
  courses: { name: '', courseUrl: '', completionDate: '' },
  employment: { company: '', role: '', startDate: '', endDate: '' },
}

const collectionLabels = {
  specialisedAreas: 'Specialised areas',
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

function ResultPanel({ title, data }) {
  if (!data) return null

  return (
    <article className="panel wide">
      <h2>{title}</h2>
      <pre className="result-json">{JSON.stringify(data, null, 2)}</pre>
    </article>
  )
}

function formatMoney(value) {
  if (value === undefined || value === null || value === '') return 'Not set'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : 'Not set'
}

function BidSummary({ status }) {
  if (!status) {
    return (
      <article className="panel bid-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Bid status</p>
            <h2>My current bid</h2>
          </div>
        </div>
        <p className="empty-state">Select a target date and check your status.</p>
      </article>
    )
  }

  const monthlyLimit = status.monthlyLimit || {}

  return (
    <article className="panel bid-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Bid status</p>
          <h2>My current bid</h2>
        </div>
        <span className={`status-chip ${String(status.blindStatus || 'pending').toLowerCase()}`}>
          {status.blindStatus || 'Pending'}
        </span>
      </div>
      <div className="bid-metrics">
        <div>
          <span>Target date</span>
          <strong>{formatDate(status.targetFeaturedDate)}</strong>
        </div>
        <div>
          <span>My bid</span>
          <strong>{status.bid ? formatMoney(status.bid.amount) : 'No bid'}</strong>
        </div>
        <div>
          <span>Monthly wins</span>
          <strong>{monthlyLimit.winsCount ?? 0}/{monthlyLimit.totalAllowed ?? 3}</strong>
        </div>
        <div>
          <span>Remaining slots</span>
          <strong>{monthlyLimit.remainingWins ?? 0}</strong>
        </div>
      </div>
      <p className="bid-note">
        {status.featuredSelected
          ? 'Winner selection has completed for this date.'
          : 'Highest bid amount remains hidden while bids are open.'}
      </p>
    </article>
  )
}

function FeaturedResult({ featured, reveal }) {
  const visible = reveal?.winner || featured?.featured

  return (
    <article className="panel bid-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Featured alumni</p>
          <h2>{visible ? visible.alumnusName || 'Selected alumnus' : 'No winner revealed'}</h2>
        </div>
        <span className={`status-chip ${reveal?.revealed ? 'won' : 'pending'}`}>
          {reveal?.revealed ? 'Revealed' : 'Blind'}
        </span>
      </div>
      <p className="bid-note">Date: {formatDate(reveal?.targetFeaturedDate || featured?.targetFeaturedDate)}</p>
      {visible?.items?.length > 0 ? (
        <div className="winner-items">
          {visible.items.map((item, index) => (
            <span key={`${item.type}-${item.name}-${index}`}>{item.type.replaceAll('_', ' ')}: {item.name}</span>
          ))}
        </div>
      ) : (
        <p className="empty-state">{reveal?.message || 'No featured alumnus has been selected for this date yet.'}</p>
      )}
    </article>
  )
}

function BidHistory({ history }) {
  const entries = history?.entries || []
  if (!entries.length) return null

  return (
    <article className="panel wide bid-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Tracking</p>
          <h2>Bid history {history.targetFeaturedDate ? `for ${history.targetFeaturedDate}` : ''}</h2>
        </div>
      </div>
      <div className="bid-history-list">
        {entries.map((entry) => (
          <div className="bid-history-item" key={entry.id}>
            <strong>{formatDate(entry.targetFeaturedDate)}</strong>
            <span>{formatMoney(entry.amount)}</span>
            <span>{new Date(entry.createdAt).toLocaleString()}</span>
            <span className={`status-chip ${String(entry.action || 'pending').toLowerCase()}`}>{entry.action}</span>
          </div>
        ))}
      </div>
    </article>
  )
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
      value: key.toLowerCase().includes('date') ? String(value).slice(0, 10) : String(value),
    }))
}

function alumnusName(item) {
  const profile = item.profile || {}
  return profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || item.email
}

function alumnusProgrammes(item) {
  return (item.profile?.degrees || []).map((degree) => degree.title).filter(Boolean)
}

function alumnusGraduationDates(item) {
  return (item.profile?.degrees || []).map((degree) => dateOnly(degree.completionDate)).filter(Boolean)
}

function fieldLabel(key) {
  const labels = {
    title: 'Degree title',
    institutionName: 'Institute name',
    degreeUrl: 'Degree URL',
    completionDate: 'Completion date',
    issuerUrl: 'Issuer URL',
    courseUrl: 'Course URL',
    startDate: 'Start date',
    endDate: 'End date',
  }

  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
}

function Dashboard({ view = 'home' }) {
  const navigate = useNavigate()
  const stored = getStoredAuth()
  const [authUser, setAuthUser] = useState(stored.user)
  const [profile, setProfile] = useState(emptyProfile)
  const [collections, setCollections] = useState(collectionTemplates)
  const [completion, setCompletion] = useState(null)
  const [featuredDate, setFeaturedDate] = useState(dateOnly(new Date()))
  const [bidForm, setBidForm] = useState({ targetFeaturedDate: dateOnly(new Date()), amount: '10000' })
  const [adminWinnerDate, setAdminWinnerDate] = useState('')
  const [creditForm, setCreditForm] = useState({
    userId: '',
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    extraWinsAllowed: '1',
  })
  const [trendFilters, setTrendFilters] = useState({ programme: '', graduationDate: '', industrySector: '' })
  const [alumniFilters, setAlumniFilters] = useState({ programme: '', graduationDate: '', industrySector: '' })
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
  const canEditProfile = role === 'ALUMNUS' || role === 'SPONSOR'
  const isProfileView = view === 'profile'
  const isBidsView = view === 'bids'
  const isGraphsView = view === 'graphs'
  const isAlumniView = view === 'alumni'
  const isDashboardView = view === 'home'

  const profilePayload = useMemo(() => compactBody({
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    bio: profile.bio,
    contactNumber: profile.contactNumber,
    linkedinUrl: profile.linkedinUrl,
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

    const nextUser = result?.user || authUser

    if (nextUser && ['ALUMNUS', 'SPONSOR'].includes(nextUser.role)) {
      const profileResult = await run(async () => apiRequest('/api/profile/me'), null)
      if (profileResult?.profile) {
        hydrateProfile(profileResult.profile)
        setAuthUser((current) => ({ ...(current || profileResult.user), profile: profileResult.profile }))
      }

      const completionResult = await run(async () => apiRequest('/api/profile/me/completion-status'), null)
      if (completionResult?.completionStatus) setCompletion(completionResult.completionStatus)
    } else {
      setCompletion(null)
    }
  }

  async function handleLogout() {
    await logoutRequest()
    navigate('/login', { replace: true, state: { message: 'Logged out successfully.' } })
  }

  async function saveProfile(event) {
    event.preventDefault()
    const existingProfile = authUser?.profile || {}
    const result = await run(async () => apiRequest('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify({
        ...profilePayload,
        profilePageUrl: authUser?.profile?.profilePageUrl || '',
        specialisedAreas: existingProfile.specialisedAreas || [],
        degrees: existingProfile.degrees || [],
        certifications: existingProfile.certifications || [],
        licences: existingProfile.licences || [],
        courses: existingProfile.courses || [],
        employment: existingProfile.employment || [],
      }),
    }), 'Profile saved successfully.')
    if (result?.profile) {
      hydrateProfile(result.profile)
      setAuthUser((current) => ({ ...(current || {}), profile: result.profile }))
      setProfileEditMode(false)
    }
  }

  async function deleteAccount() {
    const confirmed = window.confirm('Delete your account and all related information? This cannot be undone.')
    if (!confirmed) return

    const { refreshToken } = getStoredAuth()

    const result = await run(async () => apiRequest('/auth/me', {
      method: 'DELETE',
      body: JSON.stringify({ refreshToken }),
    }), null)

    if (result) {
      clearAuth()
      navigate('/login', { replace: true, state: { message: 'Account deleted successfully.' } })
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
    if (result) {
      setBidStatus(result)
      await loadBidHistory()
    }
  }

  async function increaseBid() {
    const result = await run(async () => apiRequest('/api/bids/me/increase', {
      method: 'PUT',
      body: JSON.stringify(bidForm),
    }))
    if (result) {
      setBidStatus(result)
      await loadBidHistory()
    }
  }

  async function cancelBid() {
    const result = await run(async () => apiRequest(`/api/bids/me?targetFeaturedDate=${bidForm.targetFeaturedDate}`, { method: 'DELETE' }))
    if (result) {
      setBidStatus(null)
      await loadBidHistory()
    }
  }

  async function loadBidHistory() {
    const query = bidForm.targetFeaturedDate ? `?targetFeaturedDate=${bidForm.targetFeaturedDate}` : ''
    const result = await run(async () => apiRequest(`/api/bids/history${query}`), 'Bid history loaded.')
    if (result) setBidHistory(result)
  }

  async function loadAlumni(filters = alumniFilters) {
    const params = new URLSearchParams()

    if (filters.programme) params.set('programme', filters.programme)
    if (filters.graduationDate) params.set('graduationDate', filters.graduationDate)
    if (filters.industrySector) params.set('industrySector', filters.industrySector)

    const query = params.toString() ? `?${params.toString()}` : ''
    const result = await run(async () => apiRequest(`/api/alumni${query}`), 'Alumni loaded.')
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
    if (filters.industrySector) params.set('industrySector', filters.industrySector)

    const query = params.toString() ? `?${params.toString()}` : ''
    const result = await run(async () => apiRequest(`/api/trends${query}`), 'Trends loaded.')
    if (result) setTrends(result)
  }

  async function applyTrendFilters(event) {
    event.preventDefault()
    await loadTrends(trendFilters)
  }

  async function clearTrendFilters() {
    const filters = { programme: '', graduationDate: '', industrySector: '' }
    setTrendFilters(filters)
    await loadTrends(filters)
  }

  async function applyAlumniFilters(event) {
    event.preventDefault()
    await loadAlumni(alumniFilters)
  }

  async function clearAlumniFilters() {
    const filters = { programme: '', graduationDate: '', industrySector: '' }
    setAlumniFilters(filters)
    await loadAlumni(filters)
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
    if (result) {
      setReveal(result)
      if (adminWinnerDate) {
        setFeaturedDate(adminWinnerDate)
        const query = `?targetFeaturedDate=${adminWinnerDate}`
        const revealResult = await run(async () => apiRequest(`/api/bids/reveal/current${query}`), null)
        if (revealResult) setReveal(revealResult)
      }
    }
  }

  async function addEventCredit(event) {
    event.preventDefault()
    const result = await run(async () => apiRequest('/api/bids/event-credit', {
      method: 'POST',
      body: JSON.stringify(creditForm),
    }))
    if (result) setNotice('Monthly event credit saved successfully.')
  }

  const profileDetailSections = Object.keys(collectionTemplates).filter((section) => section !== 'specialisedAreas')
  const profileCollections = profileDetailSections.map((section) => ({
    section,
    label: collectionLabels[section],
    items: authUser?.profile?.[section] || [],
  }))
  const specialisedAreas = authUser?.profile?.specialisedAreas || []
  const hasProfileSections = profileCollections.some((section) => section.items.length > 0)
  const hasProfileDetails = [
    profile.displayName,
    profile.contactNumber,
    profile.firstName,
    profile.lastName,
    profile.bio,
    profile.linkedinUrl,
  ].some(hasValue)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block compact">
          <Link className="dashboard-brand-link" to="/dashboard" aria-label="Go to graph page">
            <img className="brand-mark" src="/logo.png" alt="Alumni Club logo" />
            <div>
              <h1>Alumni Club</h1>
              <p>{authUser?.email} - {role}</p>
            </div>
          </Link>
        </div>
        <div className="header-actions">
          <nav className="dashboard-nav" aria-label="Dashboard navigation">
            <Link className={`dashboard-nav-link${isDashboardView ? ' active' : ''}`} to="/dashboard">Dashboard</Link>
            <Link className={`dashboard-nav-link${isGraphsView ? ' active' : ''}`} to="/graphs">Graphs</Link>
            {canViewAlumni && <Link className={`dashboard-nav-link${isAlumniView ? ' active' : ''}`} to="/alumni">Alumni</Link>}
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
                {canEditProfile && <Link className="profile-menu-item" to="/profile" role="menuitem">My profile</Link>}
                <button type="button" className="profile-menu-item danger-menu-item" onClick={deleteAccount} role="menuitem">
                  Delete account
                </button>
                <button type="button" className="profile-menu-item" onClick={handleLogout} role="menuitem">
                  Logout
                </button>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {isBidsView && <Message state={state} />}
      {isProfileView && state.message === 'Profile saved successfully.' && <Message state={state} />}

      <section className="dashboard-grid">
        {isDashboardView && (
          <article className="panel wide dashboard-overview">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Dashboard</p>
                <h2>Alumni system overview</h2>
              </div>
            </div>
            <div className="dashboard-quick-grid">
              <Link className="quick-card" to="/graphs">
                <span>Graphs</span>
                <strong>Programme, graduation, skills, sector, jobs, employers, and location charts</strong>
              </Link>
              {canViewAlumni && (
                <Link className="quick-card" to="/alumni">
                  <span>Alumni</span>
                  <strong>View alumni by programme, graduation date, and industry sector</strong>
                </Link>
              )}
              <Link className="quick-card" to="/bids">
                <span>Blind bidding</span>
                <strong>Place bids, track status, and view featured alumni</strong>
              </Link>
              {canEditProfile && (
                <Link className="quick-card" to="/profile">
                  <span>Profile</span>
                  <strong>Maintain profile, education, courses, and employment details</strong>
                </Link>
              )}
            </div>
          </article>
        )}

        {isGraphsView && (
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
            <Field label="Industry sector">
              <select
                value={trendFilters.industrySector}
                onChange={(event) => setTrendFilters((current) => ({ ...current, industrySector: event.target.value }))}
              >
                <option value="">All industry sectors</option>
                {(trends?.filters?.industrySectors || []).map((sectorOption) => (
                  <option key={sectorOption} value={sectorOption}>{sectorOption}</option>
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
            <TrendChart title="Specialised areas" items={trends?.charts?.specialisedAreas || []} />
            <TrendChart title="Employment by industry sector" items={trends?.charts?.employmentByIndustrySector || []} />
            <TrendChart title="Most common job titles" items={trends?.charts?.mostCommonJobTitles || []} />
            <TrendChart title="Top employers" items={trends?.charts?.topEmployers || []} />
            <TrendChart title="Geographic distribution" items={trends?.charts?.geographicDistribution || []} />
          </div>
          </article>
        )}

        {isProfileView && !canEditProfile && (
          <article className="panel wide profile-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Account</p>
                <h2>Student access</h2>
              </div>
            </div>
            <p className="empty-state">Students can view featured alumni and trends without adding alumni profile details.</p>
          </article>
        )}

        {isProfileView && canEditProfile && (
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
                </div>
                {hasValue(profile.bio) && (
                  <div className="profile-bio">
                    <span>Bio</span>
                    <p>{profile.bio}</p>
                  </div>
                )}
                {specialisedAreas.length > 0 && (
                  <div className="profile-bio">
                    <span>Areas specialised</span>
                    <div className="area-tags">
                      {specialisedAreas.map((area) => (
                        <strong key={area.id}>{area.name}</strong>
                      ))}
                    </div>
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
              <form className="dashboard-form" onSubmit={saveProfile}>
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
                </div>
                <div className="button-row">
                  <button type="submit">Save</button>
                </div>
              </form>
              <div className="image-row">
                {profile.profileImage && <img className="profile-preview" src={assetUrl(profile.profileImage)} alt="Profile" />}
                <Field label="Profile image">
                  <input type="file" accept="image/*" onChange={uploadImage} />
                </Field>
              </div>
              {isAlumnus && (
                <section className="specialised-area-editor" aria-labelledby="specialised-area-title">
                  <div>
                    <p className="panel-kicker">Areas specialised</p>
                    <h3 id="specialised-area-title">Specialised areas</h3>
                  </div>
                  <div className="specialised-area-add">
                    <input
                      aria-label="Specialised area"
                      value={collections.specialisedAreas.name}
                      onChange={(event) => setCollections((current) => ({
                        ...current,
                        specialisedAreas: { name: event.target.value },
                      }))}
                    />
                    <button
                      type="button"
                      className="plus-button"
                      aria-label="Add specialised area"
                      disabled={!collections.specialisedAreas.name.trim()}
                      onClick={() => addCollectionItem('specialisedAreas')}
                    >
                      +
                    </button>
                  </div>
                  {specialisedAreas.length > 0 && (
                    <div className="area-tags editable-area-tags">
                      {specialisedAreas.map((area) => (
                        <span className="editable-area-tag" key={area.id}>
                          <input
                            aria-label="Specialised area name"
                            value={area.name}
                            onChange={(event) => setAuthUser((current) => ({
                              ...(current || {}),
                              profile: {
                                ...(current?.profile || {}),
                                specialisedAreas: specialisedAreas.map((item) => (
                                  item.id === area.id ? { ...item, name: event.target.value } : item
                                )),
                              },
                            }))}
                          />
                          <button type="button" onClick={() => updateCollectionItem('specialisedAreas', area)}>Update</button>
                          <button type="button" className="light-button" onClick={() => deleteCollectionItem('specialisedAreas', area.id)}>Remove</button>
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              )}
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
                {Object.keys(collectionTemplates).filter((section) => section !== 'specialisedAreas').map((section) => (
                  <section className="mini-panel" key={section}>
                    <h3>{collectionLabels[section]}</h3>
                    <div className="dashboard-form">
                      {Object.keys(collectionTemplates[section]).map((key) => (
                        <Field key={key} label={fieldLabel(key)}>
                          {section === 'degrees' && key === 'title' ? (
                            <select
                              value={collections.degrees.title}
                              onChange={(event) => setCollections((current) => ({
                                ...current,
                                degrees: { ...current.degrees, title: event.target.value, institutionName: IIT_INSTITUTION_NAME },
                              }))}
                            >
                              <option value="">Select programme</option>
                              {degreeProgrammes.map((programme) => (
                                <option key={programme} value={programme}>{programme}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={key.toLowerCase().includes('date') ? 'date' : 'text'}
                              value={section === 'degrees' && key === 'institutionName' ? IIT_INSTITUTION_NAME : collections[section][key]}
                              readOnly={section === 'degrees' && key === 'institutionName'}
                              onChange={(event) => setCollections((current) => ({
                                ...current,
                                [section]: { ...current[section], [key]: event.target.value },
                              }))}
                            />
                          )}
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
        <article className="panel bid-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Blind bidding</p>
              <h2>Featured date</h2>
            </div>
          </div>
          <div className="dashboard-form">
            <Field label="Featured date">
              <input type="date" value={featuredDate} onChange={(event) => setFeaturedDate(event.target.value)} />
            </Field>
            <div className="button-row">
              <button type="button" onClick={loadFeatured}>Public featured</button>
              <button type="button" onClick={loadReveal}>Reveal winner</button>
            </div>
          </div>
        </article>

        {isAlumnus && (
          <article className="panel bid-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Bid placement</p>
                <h2>My bids</h2>
              </div>
            </div>
            <form className="dashboard-form" onSubmit={placeBid}>
              <Field label="Target featured date">
                <input type="date" value={bidForm.targetFeaturedDate} onChange={(event) => setBidForm({ ...bidForm, targetFeaturedDate: event.target.value })} required />
              </Field>
              <Field label="Amount">
                <input value={bidForm.amount} onChange={(event) => setBidForm({ ...bidForm, amount: event.target.value })} placeholder="10000" required />
              </Field>
              <div className="button-row">
                <button type="submit">Place bid</button>
                <button type="button" onClick={increaseBid}>Increase bid</button>
                <button type="button" onClick={cancelBid}>Cancel bid</button>
                <button type="button" onClick={loadBidStatus}>Status</button>
                <button type="button" onClick={loadBidHistory}>History</button>
              </div>
            </form>
          </article>
        )}

          </>
        )}

        {isBidsView && (
          <>
            <FeaturedResult featured={featured} reveal={reveal} />
            {isAlumnus && <BidSummary status={bidStatus} />}
            {isAlumnus && <BidHistory history={bidHistory} />}
          </>
        )}

        {isAlumniView && canViewAlumni && (
          <article className="panel wide">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Alumni directory</p>
                <h2>View alumni by programme, graduation date, and industry sector</h2>
              </div>
              <span className="metric-pill">{alumni.length} alumni</span>
            </div>
            <form className="trend-filters" onSubmit={applyAlumniFilters}>
              <Field label="Programme">
                <select
                  value={alumniFilters.programme}
                  onChange={(event) => setAlumniFilters((current) => ({ ...current, programme: event.target.value }))}
                >
                  <option value="">All programmes</option>
                  {(trends?.filters?.programmes || degreeProgrammes).map((programmeOption) => (
                    <option key={programmeOption} value={programmeOption}>{programmeOption}</option>
                  ))}
                </select>
              </Field>
              <Field label="Graduation date">
                <select
                  value={alumniFilters.graduationDate}
                  onChange={(event) => setAlumniFilters((current) => ({ ...current, graduationDate: event.target.value }))}
                >
                  <option value="">All graduation dates</option>
                  {(trends?.filters?.graduationDates || []).map((dateOption) => (
                    <option key={dateOption} value={dateOption}>{dateOption}</option>
                  ))}
                </select>
              </Field>
              <Field label="Industry sector">
                <select
                  value={alumniFilters.industrySector}
                  onChange={(event) => setAlumniFilters((current) => ({ ...current, industrySector: event.target.value }))}
                >
                  <option value="">All industry sectors</option>
                  {(trends?.filters?.industrySectors || []).map((sectorOption) => (
                    <option key={sectorOption} value={sectorOption}>{sectorOption}</option>
                  ))}
                </select>
              </Field>
              <div className="button-row trend-actions">
                <button type="submit">View alumni</button>
                <button type="button" className="light-button" onClick={clearAlumniFilters}>Clear</button>
              </div>
            </form>
            <div className="directory">
              {alumni.map((item) => (
                <div className="list-item" key={item.id}>
                  <span>
                    <strong>{alumnusName(item)}</strong>
                    <small>{alumnusProgrammes(item).join(', ') || 'Programme not recorded'} | {alumnusGraduationDates(item).join(', ') || 'Graduation date not recorded'} | {(item.industrySectors || []).join(', ') || 'Industry sector not recorded'}</small>
                  </span>
                  <div className="button-row compact-buttons">
                    <button type="button" onClick={() => loadAlumnus(item.id)}>View</button>
                    {isAdmin && <button type="button" onClick={() => deleteAlumnus(item.id)}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}

        {isAlumniView && canViewAlumni && <ResultPanel title="Selected alumnus" data={selectedAlumnus} />}

        {isBidsView && isAdmin && (
          <article className="panel wide bid-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Admin</p>
                <h2>Winner selection and event credits</h2>
              </div>
            </div>
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
