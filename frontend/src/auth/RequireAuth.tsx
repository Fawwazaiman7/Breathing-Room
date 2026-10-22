import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  if (status === 'loading') {
    return <p className="page-message">Loading…</p>;
  }
  if (status === 'signedOut') {
    // Open the sign-in page for the portal the visitor was heading to, and
    // come back to the same page afterwards.
    return (
      <Navigate
        to={`/sign-in?as=${role}`}
        replace
        state={{ from: location.pathname }}
      />
    );
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
    // The other portal's sign-in page explains that this account belongs to
    // a different portal and offers the way back.
    return <Navigate to={`/sign-in?as=${role}`} replace />;
  }
  return <>{children}</>;
}
