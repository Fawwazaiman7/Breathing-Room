import { Injectable, Logger } from '@nestjs/common';
import type { FeedbackContext } from './feedback.context.js';
import { generateFeedback } from './feedback.generator.js';
import { GroqClient } from './groq.client.js';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly groq: GroqClient) {}

  /**
   * Returns a checked note, or null if none could be produced. Never
   * throws: the screening result stands on its own without the note.
   */
  async generate(context: FeedbackContext): Promise<string | null> {
    try {
      return await generateFeedback(
        context,
        (messages) => this.groq.complete(messages),
        (reason, attempt) =>
          this.logger.warn(`Note rejected (attempt ${attempt}): ${reason}`),
      );
    } catch (error) {
      this.logger.error(
        `Could not generate a note: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
