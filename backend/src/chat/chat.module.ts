import { Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { ChatController } from './chat.controller.js';
import { ChatRepository } from './chat.repository.js';
import { ChatService } from './chat.service.js';
import { GeminiClient } from './gemini.client.js';

@Module({
  // FeedbackModule provides the Groq client that writes the replies.
  imports: [FeedbackModule],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, GeminiClient, AuthGuard],
})
export class ChatModule {}
