import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AuthenticatedRequest, UserRole } from './auth.types.js';

/**
 * Requires a valid Supabase access token in the Authorization header
 * ("Bearer <token>"). The token is verified with Supabase Auth, then the
 * user's role is read from public.profiles. The role always comes from the
 * database, never from anything the client sends.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const { data: profile, error: profileError } = await this.supabase.admin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();
    if (profileError || !profile) {
      throw new UnauthorizedException('No profile found for this account.');
    }

    request.user = { id: data.user.id, role: profile.role as UserRole };
    return true;
  }
}
