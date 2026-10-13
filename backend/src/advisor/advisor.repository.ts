import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { ADVISOR_SCREENING_COLUMNS } from './advisor.view.js';
import type { AdviseeProfileRow, AdviseeScreeningRow } from './advisor.view.js';

const PROFILE_COLUMNS = 'id, full_name, student_number, class_name';
const SCREENING_COLUMNS = ADVISOR_SCREENING_COLUMNS.join(', ');

/**
 * Database reads for the advisor views. Every query is scoped to the
 * signed-in advisor's own advisees (profiles.advisor_id = advisor id).
 */
@Injectable()
export class AdvisorRepository {
  private readonly logger = new Logger(AdvisorRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAdvisees(advisorId: string): Promise<AdviseeProfileRow[]> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('advisor_id', advisorId)
      .eq('role', 'student')
      .order('full_name', { ascending: true });
    if (error) {
      this.logger.error(`Advisee query failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load your students.');
    }
    return (data ?? []) as AdviseeProfileRow[];
  }

  /** One advisee, only if that student is assigned to this advisor. */
  async findAdvisee(
    advisorId: string,
    studentId: string,
  ): Promise<AdviseeProfileRow | null> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', studentId)
      .eq('advisor_id', advisorId)
      .eq('role', 'student')
      .maybeSingle();
    if (error) {
      this.logger.error(`Advisee lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load this student.');
    }
    return (data as AdviseeProfileRow | null) ?? null;
  }

  /** Summary columns only; raw answers are never selected here. */
  async findScreenings(studentIds: string[]): Promise<AdviseeScreeningRow[]> {
    if (studentIds.length === 0) {
      return [];
    }
    const { data, error } = await this.supabase.admin
      .from('screenings')
      .select(SCREENING_COLUMNS)
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });
    if (error) {
      this.logger.error(`Screening query failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load screenings.');
    }
    return (data ?? []) as unknown as AdviseeScreeningRow[];
  }
}
