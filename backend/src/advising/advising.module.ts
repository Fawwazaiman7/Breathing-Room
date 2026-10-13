import { Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AdvisingController } from './advising.controller.js';
import { AdvisingRepository } from './advising.repository.js';
import { AdvisingService } from './advising.service.js';

@Module({
  controllers: [AdvisingController],
  providers: [AdvisingService, AdvisingRepository, AuthGuard],
})
export class AdvisingModule {}
