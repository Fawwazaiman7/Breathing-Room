import { Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ProfileController } from './profile.controller.js';
import { ProfileRepository } from './profile.repository.js';
import { ProfileService } from './profile.service.js';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, ProfileRepository, AuthGuard],
})
export class ProfileModule {}
