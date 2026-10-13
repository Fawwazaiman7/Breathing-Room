import type { Request } from 'express';

export type UserRole = 'student' | 'advisor';

/** The signed-in user, attached to the request by AuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
