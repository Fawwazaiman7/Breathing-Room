import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ChatMessageDto } from './chat.dto.js';
import type { ChatReply } from './chat.logic.js';
import { ChatService } from './chat.service.js';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** POST /chat/messages — one question in, one reply out. */
  @Post('messages')
  @HttpCode(200)
  send(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChatMessageDto,
  ): Promise<ChatReply> {
    return this.chatService.reply(user, dto.message, dto.history ?? []);
  }
}
