import { Link } from 'react-router-dom'

const highlights = [
  {
    title: 'Build your alumni profile',
    text: 'Keep your education, certifications, work history, LinkedIn, and profile image in one verified place.',
  },
  {
    title: 'Discover alumni trends',
    text: 'Explore charts for skills gaps, industries, job titles, employers, and geographic distribution.',
  },
  {
    title: 'Support featured profiles',
    text: 'Sponsors and alumni can use featured profile bidding tools to promote community visibility.',
  },
]

function Details() {
  return (
    <main className="details-shell">
      <nav className="public-nav" aria-label="Public navigation">
        <Link className="public-brand" to="/">
          <img className="brand-mark" src="/logo.png" alt="Alumni Club logo" />
          <span>Alumni Club</span>
        </Link>
        <div className="public-nav-actions">
          <Link className="nav-link" to="/login">Login</Link>
          <Link className="nav-button" to="/signup">Sign up</Link>
        </div>
      </nav>

      <section className="details-hero" aria-labelledby="details-title">
        <div className="details-copy">
          <p className="intro-kicker">University alumni network</p>
          <h1 id="details-title">Stay connected beyond graduation.</h1>
          <p>
            Alumni Club helps graduates, sponsors, and administrators manage profiles,
            discover career trends, and strengthen the university community.
          </p>
          <div className="details-actions">
            <Link className="primary-link" to="/signup">Create account</Link>
            <Link className="secondary-link" to="/login">Login</Link>
          </div>
        </div>

      </section>

      <section className="details-grid" aria-label="Alumni Club features">
        {highlights.map((item) => (
          <article className="detail-card" key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

export default Details
