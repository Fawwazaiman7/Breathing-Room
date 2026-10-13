import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/auth.types.js';
import { GroqClient } from '../feedback/groq.client.js';
import { answerChat, ChatError } from './chat.logic.js';
import type { ChatDeps, ChatReply } from './chat.logic.js';
import { ChatRepository } from './chat.repository.js';
import type { ChatTurn } from './chat.types.js';
import { GeminiClient } from './gemini.client.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly minPassageSimilarity: number;
  private readonly deps: ChatDeps;

  constructor(
    config: ConfigService,
    repository: ChatRepository,
    gemini: GeminiClient,
    groq: GroqClient,
  ) {
    // Optional: CHAT_MIN_SIMILARITY=0.58 turns away questions whose closest
    // knowledge base passage is less similar than that, without calling the
    // language model. Unset or 0 switches this off. Pick a value with
    // "node kb/evaluate-chat.mjs".
    const threshold = Number(config.get<string>('CHAT_MIN_SIMILARITY'));
    this.minPassageSimilarity =
      Number.isFinite(threshold) && threshold > 0 && threshold < 1
        ? threshold
        : 0;

    this.deps = {
      embedQuery: (text) => gemini.embedQuery(text),
      loadIntentExamples: () => repository.loadIntentExamples(),
      matchPassages: (embedding, count) =>
        repository.matchPassages(embedding, count),
      latestResult: (studentId) => repository.latestResult(studentId),
      complete: (messages) => groq.complete(messages),
      // The student's words are never written to the log.
      log: (event, detail) =>
        this.logger.log(`${event} ${JSON.stringify(detail)}`),
    };
  }

  async reply(
    user: AuthUser,
    message: string,
    history: readonly ChatTurn[],
  ): Promise<ChatReply> {
    if (user.role !== 'student') {
      throw new ForbiddenException('The Support Chat is for students.');
    }
    if (message.trim() === '') {
      throw new BadRequestException('Write a message first.');
    }
    try {
      return await answerChat(
        this.deps,
        { studentId: user.id, message, history },
        { minPassageSimilarity: this.minPassageSimilarity },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Support Chat unavailable${error instanceof ChatError ? ` (${error.kind})` : ''}: ${detail}`,
      );
      throw new ServiceUnavailableException(
        'The Support Chat is not available right now. Please try again later.',
      );
    }
  }
}
