import { Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { ScreeningController } from './screening.controller.js';
import { ScreeningRepository } from './screening.repository.js';
import { ScreeningService } from './screening.service.js';

@Module({
  imports: [FeedbackModule],
  controllers: [ScreeningController],
  providers: [ScreeningService, ScreeningRepository, AuthGuard],
  exports: [ScreeningService],
})
export class ScreeningModule {}
