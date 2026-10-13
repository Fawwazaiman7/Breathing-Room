import { Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AdvisorController } from './advisor.controller.js';
import { AdvisorRepository } from './advisor.repository.js';
import { AdvisorService } from './advisor.service.js';

@Module({
  controllers: [AdvisorController],
  providers: [AdvisorService, AdvisorRepository, AuthGuard],
})
export class AdvisorModule {}
