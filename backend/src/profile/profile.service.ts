import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { ProfileError, updateMyProfile } from './profile.logic.js';
import type { ProfileInput, ProfileView } from './profile.logic.js';
import { ProfileRepository } from './profile.repository.js';

@Injectable()
export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  /** Saves the signed-in user's own details. */
  async update(user: AuthUser, input: ProfileInput): Promise<ProfileView> {
    try {
      return await updateMyProfile(this.repository, user, input);
    } catch (error) {
      if (error instanceof ProfileError) {
        switch (error.kind) {
          case 'INVALID':
            throw new BadRequestException(error.message);
          case 'STUDENT_NUMBER_TAKEN':
            throw new ConflictException(error.message);
          default:
            throw new NotFoundException(error.message);
        }
      }
      throw error;
    }
  }
}
