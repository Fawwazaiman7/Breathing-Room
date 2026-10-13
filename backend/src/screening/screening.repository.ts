import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { ScreeningRow, StoredScreening } from './screening.mapper.js';

@Injectable()
export class ScreeningRepository {
  private readonly logger = new Logger(ScreeningRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async insert(row: ScreeningRow): Promise<StoredScreening> {
    const { data, error } = await this.supabase.admin
      .from('screenings')
      .insert(row)
      .select()
      .single();
    if (error || !data) {
      this.logger.error(`Insert failed: ${error?.message ?? 'no row returned'}`);
      throw new InternalServerErrorException(
        'Could not save the screening. Please try again.',
      );
    }
    return data as StoredScreening;
  }

  /** Newest first. Always scoped to one student. */
  async findByStudent(studentId: string): Promise<StoredScreening[]> {
    const { data, error } = await this.supabase.admin
      .from('screenings')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) {
      this.logger.error(`History query failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Could not load your screening history.',
      );
    }
    return (data ?? []) as StoredScreening[];
  }

  /** True when the student is linked to an Academic Advisor. */
  async hasAdvisor(studentId: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('advisor_id')
      .eq('id', studentId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Advisor check failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Could not check your Academic Advisor. Please try again.',
      );
    }
    return Boolean((data as { advisor_id: string | null } | null)?.advisor_id);
  }

  /** One screening, only if it belongs to the given student. */
  async findOneForStudent(
    id: string,
    studentId: string,
  ): Promise<StoredScreening | null> {
    const { data, error } = await this.supabase.admin
      .from('screenings')
      .select('*')
      .eq('id', id)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load the screening.');
    }
    return (data as StoredScreening | null) ?? null;
  }

  /**
   * Stores the LLM note. Only the two feedback columns are written; the
   * rule-based result columns are never touched after the insert.
   */
  async saveFeedback(
    id: string,
    studentId: string,
    text: string,
  ): Promise<void> {
    const { error } = await this.supabase.admin
      .from('screenings')
      .update({
        feedback_text: text,
        feedback_generated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('student_id', studentId);
    if (error) {
      // The note can still be shown this time; it will be regenerated later.
      this.logger.error(`Saving the note failed: ${error.message}`);
    }
  }
}
