import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { AdvisorRepository } from './advisor.repository.js';
import {
  buildAdviseeDetail,
  buildAdviseeList,
  buildOverview,
} from './advisor.view.js';
import type {
  AdviseeDetail,
  AdviseeListItem,
  AdvisorOverview,
} from './advisor.view.js';

export interface AdvisorDashboard {
  overview: AdvisorOverview;
  students: AdviseeListItem[];
}

@Injectable()
export class AdvisorService {
  constructor(private readonly repository: AdvisorRepository) {}

  private assertAdvisor(user: AuthUser): void {
    if (user.role !== 'advisor') {
      throw new ForbiddenException('Only Academic Advisors can view this.');
    }
  }

  async dashboard(user: AuthUser): Promise<AdvisorDashboard> {
    this.assertAdvisor(user);
    const profiles = await this.repository.findAdvisees(user.id);
    const screenings = await this.repository.findScreenings(
      profiles.map((profile) => profile.id),
    );
    const students = buildAdviseeList(profiles, screenings);
    return { overview: buildOverview(students), students };
  }

  async student(user: AuthUser, studentId: string): Promise<AdviseeDetail> {
    this.assertAdvisor(user);
    const profile = await this.repository.findAdvisee(user.id, studentId);
    if (!profile) {
      // Same answer whether the student does not exist or belongs to
      // another advisor, so nothing is revealed about other students.
      throw new NotFoundException('Student not found.');
    }
    const screenings = await this.repository.findScreenings([profile.id]);
    return buildAdviseeDetail(profile, screenings);
  }
}
