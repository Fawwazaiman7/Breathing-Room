import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Logo } from '../components/Logo';

/** Placeholder until the advisor dashboard is built. */
export function AdvisorPlaceholderPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="auth-page">
      <Logo />
      <section className="auth-card">
        <h1 className="card-title">Advisor dashboard</h1>
        <p className="card-text">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}. The
          advisor dashboard is not available yet. It will be added in a later
          version.
        </p>
        <button
          type="button"
          className="button-secondary"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
