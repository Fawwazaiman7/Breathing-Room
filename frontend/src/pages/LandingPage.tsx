import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  LeafIcon,
  MenuIcon,
} from '../components/Icons';
import { LogoLink } from '../components/Logo';
import './landing.css';
import { usePageTitle } from '../lib/usePageTitle';

/** The drawing from the Figma design: a student studying calmly at a desk. */
function HeroIllustration() {
  return (
    <svg
      className="lp-illustration"
      viewBox="0 0 560 430"
      fill="none"
      role="img"
      aria-label="Student studying calmly at a desk"
    >
      <path
        className="lp-ill-soft"
        d="M62 351c34-52 50-71 93-75 38-3 58 30 92 23 46-10 58-78 124-72 72 7 111 52 134 124H62Z"
      />
      <path
        className="lp-ill-line"
        d="M88 351h406M158 351l9-104h231l13 104M149 247h263"
      />
      <path
        className="lp-ill-fill"
        d="M218 207c4-44 25-73 64-73s65 36 62 83l-13 68H222l-4-78Z"
      />
      <path
        className="lp-ill-line"
        d="M245 151c8-27 50-37 69-9 8 12 10 27 6 41-4 13-16 25-31 26-22 2-42-19-44-58Z"
      />
      <path
        className="lp-ill-hair"
        d="M245 158c-2-32 17-50 43-48 24 2 41 20 38 49-13-2-24-11-30-23-10 13-27 21-51 22Z"
      />
      <path
        className="lp-ill-line"
        d="M261 186c8 8 18 8 27 0M267 167h.1M300 167h.1M282 209v24"
      />
      <path
        className="lp-ill-line"
        d="m255 238-43 54 57 18M313 238l38 53-56 18"
      />
      <rect
        className="lp-ill-paper"
        x="251"
        y="282"
        width="83"
        height="54"
        rx="3"
        transform="rotate(-4 251 282)"
      />
      <path
        className="lp-ill-line"
        d="m266 294 52-4m-51 13 42-3m-41 13 47-3"
      />
      <path
        className="lp-ill-line"
        d="M126 247v-56m-24 56v-36m0-20h47l-10-29h-27l-10 29ZM439 247v-65m-22 0h45"
      />
      <path
        className="lp-ill-plant"
        d="M453 246c-2-34 16-53 39-62-2 28-14 45-39 62Zm-8-1c-22-18-25-42-18-63 20 15 26 35 18 63Zm7 0c-1-27-12-45-29-57"
      />
      <path className="lp-ill-line" d="M426 247h52l-7 47h-38l-7-47Z" />
      <circle className="lp-ill-dot" cx="106" cy="113" r="5" />
      <circle className="lp-ill-dot" cx="421" cy="112" r="4" />
      <path
        className="lp-ill-line"
        d="M98 138c18-8 27-21 30-39M421 137c-17-8-25-19-28-35"
      />
    </svg>
  );
}

export function LandingPage() {
  usePageTitle();
  const { status, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // A signed-in visitor gets a way back to their workspace instead of "Sign in".
  const signedIn = status === 'signedIn' && profile !== null;
  const accountPath = !signedIn
    ? '/sign-in'
    : profile.role === 'advisor'
      ? '/advisor'
      : '/app';
  const accountLabel = signedIn ? 'Go to dashboard' : 'Sign in';

  return (
    <div className="lp">
      <header className="lp-nav">
        <LogoLink compact />
        <nav className="lp-links" aria-label="Main navigation">
          <Link to="/app">Student portal</Link>
          <Link to="/advisor">Advisor portal</Link>
          <Link className="lp-button lp-button-secondary" to={accountPath}>
            {accountLabel}
          </Link>
        </nav>
        <button
          type="button"
          className="lp-menu-button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="lp-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>
      {menuOpen && (
        <nav
          id="lp-mobile-menu"
          className="lp-mobile-menu"
          aria-label="Main navigation"
        >
          <Link to="/app">Student portal</Link>
          <Link to="/advisor">Advisor portal</Link>
          <Link to={accountPath}>{accountLabel}</Link>
        </nav>
      )}

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">
              <span></span> Academic burnout screening at PNJ
            </p>
            <h1>A calmer way to check in on your semester.</h1>
            <p className="lp-lead">
              A private, guided screening for academic burnout. It looks at
              your workload and how you have been feeling, then gives you a
              clear result and a next step.
            </p>
            <div className="lp-actions">
              <Link className="lp-button" to="/app/screening">
                Start screening
                <ArrowRightIcon size={18} />
              </Link>
              <a className="lp-text-link" href="#how-it-works">
                Learn more <ChevronRightIcon size={16} />
              </a>
            </div>
            <div className="lp-reassurance">
              <div>
                <ClockIcon size={17} />
                <span>Takes about 8–10 minutes</span>
              </div>
              <div>
                <CheckIcon size={17} />
                <span>Your answers stay private</span>
              </div>
            </div>
          </div>

          <div className="lp-illustration-wrap">
            <HeroIllustration />
            <div className="lp-note">
              <span className="lp-note-icon">
                <LeafIcon size={17} />
              </span>
              <span>
                <strong>A moment for yourself</strong>
                <small>There are no right or wrong answers.</small>
              </span>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="lp-how">
          <p className="lp-kicker">How it works</p>
          <h2>Clarity in three simple steps.</h2>
          <div className="lp-steps">
            <article>
              <span>01</span>
              <h3>Share how things feel</h3>
              <p>
                Answer straightforward questions about your workload and
                wellbeing.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Understand your result</h3>
              <p>
                Fixed rules, validated by a psychologist, give you a clear
                burnout screening result.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Choose what comes next</h3>
              <p>
                Receive practical guidance and find student support when you
                need it.
              </p>
            </article>
          </div>
        </section>

        <section className="lp-how lp-about" aria-labelledby="about-burnout">
          <p className="lp-kicker">About burnout</p>
          <h2 id="about-burnout">What is academic burnout?</h2>
          <div className="lp-steps">
            <article>
              <span>Exhaustion</span>
              <h3>Feeling drained</h3>
              <p>
                Your studies leave you tired, and rest no longer seems to
                recover your energy.
              </p>
            </article>
            <article>
              <span>Disengagement</span>
              <h3>Feeling distant</h3>
              <p>
                Your courses start to feel meaningless, and you find yourself
                pulling away from them.
              </p>
            </article>
            <article>
              <span>Workload</span>
              <h3>The pressure behind it</h3>
              <p>
                Heavy demands that last for weeks without enough recovery are
                a common cause. Burnout can change with rest and support.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span>Politeknik Negeri Jakarta · Student wellbeing support</span>
        <span>A burnout screening, not a clinical diagnosis</span>
      </footer>
    </div>
  );
}
