import { Module } from '@nestjs/common';
import { FeedbackService } from './feedback.service.js';
import { GroqClient } from './groq.client.js';

@Module({
  providers: [GroqClient, FeedbackService],
  // GroqClient is shared with the Support Chat.
  exports: [FeedbackService, GroqClient],
})
export class FeedbackModule {}
