import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UpdateProfileDto } from './profile.dto.js';
import type { ProfileView } from './profile.logic.js';
import { ProfileService } from './profile.service.js';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /** PATCH /profile — the signed-in user edits their own details. */
  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileView> {
    return this.profileService.update(user, dto);
  }
}
