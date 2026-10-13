import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from './auth-context';
import { useAuth } from './useAuth';

/**
 * Shows its children only to a signed-in user with the given role.
 * This is a convenience for navigation; the real protection is on the
 * backend and in the database access rules.
 */
export function RequireAuth({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { status, profile } = useAuth();

  if (status === 'loading') {
    return <p className="page-message">Loading…</p>;
  }
  if (status === 'signedOut') {
    // Open the sign-in page for the portal the visitor was heading to.
    return <Navigate to={`/sign-in?as=${role}`} replace />;
  }
  if (!profile) {
    return (
      <p className="page-message">
        We could not find a profile for this account. Please contact the
        administrator.
      </p>
    );
  }
  if (profile.role !== role) {
    return (
      <Navigate to={profile.role === 'advisor' ? '/advisor' : '/app'} replace />
    );
  }
  return <>{children}</>;
}
