import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  ProfilePatch,
  ProfileRow,
  ProfileStore,
  ProfileUser,
} from './profile.logic.js';

const COLUMNS = 'id, role, full_name, student_number, class_name';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ProfileRepository implements ProfileStore {
  private readonly logger = new Logger(ProfileRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async updateProfile(
    user: ProfileUser,
    patch: ProfilePatch,
  ): Promise<ProfileRow | 'student_number_taken' | null> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .update(patch)
      // Only the user's own row, and only while it still has the role the
      // patch was built for.
      .eq('id', user.id)
      .eq('role', user.role)
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return 'student_number_taken';
      }
      this.logger.error(`Profile update failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Something went wrong. Please try again.',
      );
    }
    return (data as ProfileRow | null) ?? null;
  }
}
