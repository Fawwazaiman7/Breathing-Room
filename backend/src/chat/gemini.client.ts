import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  requestGeminiEmbedding,
} from './gemini.request.js';

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly apiKey: string | undefined;
  readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY')?.trim() || undefined;
    this.model =
      config.get<string>('GEMINI_EMBEDDING_MODEL')?.trim() ||
      DEFAULT_GEMINI_EMBEDDING_MODEL;
    this.logger.log(`Using Gemini embedding model "${this.model}".`);
  }

  /** Embeds a student's question. */
  embedQuery(text: string): Promise<number[]> {
    if (!this.apiKey) {
      return Promise.reject(new Error('GEMINI_API_KEY is not set in .env.'));
    }
    return requestGeminiEmbedding({
      apiKey: this.apiKey,
      model: this.model,
      text,
      kind: 'query',
    });
  }
}
