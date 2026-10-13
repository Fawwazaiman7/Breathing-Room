import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatMessage } from './feedback.prompt.js';
import { DEFAULT_GROQ_MODEL, requestGroqCompletion } from './groq.request.js';
import type { ReasoningEffort } from './groq.request.js';

const REASONING_EFFORTS: ReasoningEffort[] = ['low', 'medium', 'high'];

@Injectable()
export class GroqClient {
  private readonly logger = new Logger(GroqClient.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly reasoningEffort: ReasoningEffort | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GROQ_API_KEY')?.trim() || undefined;
    this.model = config.get<string>('GROQ_MODEL')?.trim() || DEFAULT_GROQ_MODEL;

    // Optional: GROQ_REASONING_EFFORT=low|medium|high, for models that
    // support it. Anything else is ignored.
    const effort = config.get<string>('GROQ_REASONING_EFFORT')?.trim();
    this.reasoningEffort = REASONING_EFFORTS.find((value) => value === effort);

    this.logger.log(`Using Groq model "${this.model}".`);
  }

  complete(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      return Promise.reject(new Error('GROQ_API_KEY is not set in .env.'));
    }
    return requestGroqCompletion({
      apiKey: this.apiKey,
      model: this.model,
      messages,
      reasoningEffort: this.reasoningEffort,
    });
  }
}
