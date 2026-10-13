import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import {
  AdvisingError,
  getInviteCode,
  getMyAdvisor,
  joinAdvisor,
  previewAdvisor,
  regenerateInviteCode,
  removeStudent,
} from './advising.logic.js';
import type { AdvisorSummary } from './advising.logic.js';
import { AdvisingRepository } from './advising.repository.js';

const pick = (max: number): number => randomInt(max);

/** Turns the logic's own errors into HTTP errors. */
async function asHttp<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof AdvisingError) {
      switch (error.kind) {
        case 'FORBIDDEN_ROLE':
          throw new ForbiddenException(error.message);
        case 'INVALID_CODE':
          throw new BadRequestException(error.message);
        case 'CODE_NOT_FOUND':
        case 'NOT_FOUND':
          throw new NotFoundException(error.message);
        default:
          throw new InternalServerErrorException(error.message);
      }
    }
    throw error;
  }
}

@Injectable()
export class AdvisingService {
  constructor(private readonly repository: AdvisingRepository) {}

  async myAdvisor(user: AuthUser): Promise<{ advisor: AdvisorSummary | null }> {
    return { advisor: await asHttp(getMyAdvisor(this.repository, user)) };
  }

  /** Only the name goes back to the student before they confirm. */
  async preview(
    user: AuthUser,
    code: unknown,
  ): Promise<{ advisor: { fullName: string } }> {
    const advisor = await asHttp(previewAdvisor(this.repository, user, code));
    return { advisor: { fullName: advisor.fullName } };
  }

  async join(
    user: AuthUser,
    code: unknown,
  ): Promise<{ advisor: AdvisorSummary }> {
    return { advisor: await asHttp(joinAdvisor(this.repository, user, code)) };
  }

  async code(user: AuthUser): Promise<{ code: string }> {
    return { code: await asHttp(getInviteCode(this.repository, user, pick)) };
  }

  async regenerate(user: AuthUser): Promise<{ code: string }> {
    return {
      code: await asHttp(regenerateInviteCode(this.repository, user, pick)),
    };
  }

  async remove(user: AuthUser, studentId: string): Promise<{ removed: true }> {
    await asHttp(removeStudent(this.repository, user, studentId));
    return { removed: true };
  }
}
