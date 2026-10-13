import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { toFeedbackContext } from '../feedback/feedback.context.js';
import { FeedbackService } from '../feedback/feedback.service.js';
import { evaluateScreening, toStudentView } from './screening.evaluator.js';
import type {
  ScreeningInput,
  ScreeningResult,
  StudentScreeningView,
} from './screening.evaluator.js';
import { toHistoryItem, toScreeningRow } from './screening.mapper.js';
import type { ScreeningHistoryItem } from './screening.mapper.js';
import { ScreeningRepository } from './screening.repository.js';
import { ScreeningInputError } from './screening.types.js';

export interface SubmittedScreening extends StudentScreeningView {
  id: string;
  createdAt: string;
}

export interface ScreeningFeedback {
  /** The note, or null when none could be produced. */
  feedbackText: string | null;
}

@Injectable()
export class ScreeningService {
  constructor(
    private readonly repository: ScreeningRepository,
    private readonly feedbackService: FeedbackService,
  ) {}

  /** Runs the deterministic screening without saving anything. */
  evaluate(input: ScreeningInput): ScreeningResult {
    try {
      return evaluateScreening(input);
    } catch (error) {
      if (error instanceof ScreeningInputError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Evaluates and stores a screening for the signed-in student. The LLM
   * note is generated afterwards by `feedback()`; it never changes the
   * category decided here.
   */
  async submit(
    user: AuthUser,
    input: ScreeningInput,
  ): Promise<SubmittedScreening> {
    if (user.role !== 'student') {
      throw new ForbiddenException('Only students can submit a screening.');
    }
    // Results are shared with the student's Academic Advisor, so a student
    // links to their advisor (with the advisor's code) before screening.
    if (!(await this.repository.hasAdvisor(user.id))) {
      throw new ForbiddenException(
        'Connect to your Academic Advisor before starting a screening.',
      );
    }
    const result = this.evaluate(input);
    const stored = await this.repository.insert(
      toScreeningRow(user.id, input, result),
    );
    return {
      id: stored.id,
      createdAt: stored.created_at,
      ...toStudentView(result),
    };
  }

  async history(user: AuthUser): Promise<ScreeningHistoryItem[]> {
    const rows = await this.repository.findByStudent(user.id);
    return rows.map(toHistoryItem);
  }

  /**
   * Returns the "A note for you" text for one of the student's own
   * screenings, generating and saving it the first time it is requested.
   * The note explains the stored rule-based result and cannot alter it.
   */
  async feedback(user: AuthUser, id: string): Promise<ScreeningFeedback> {
    const stored = await this.repository.findOneForStudent(id, user.id);
    if (!stored) {
      throw new NotFoundException('Screening not found.');
    }
    if (stored.feedback_text) {
      return { feedbackText: stored.feedback_text };
    }

    const text = await this.feedbackService.generate(toFeedbackContext(stored));
    if (text) {
      await this.repository.saveFeedback(id, user.id, text);
    }
    return { feedbackText: text };
  }
}
