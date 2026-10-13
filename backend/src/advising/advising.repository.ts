import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AdvisingProfile, AdvisingStore } from './advising.logic.js';

const COLUMNS = 'id, role, full_name, advisor_id, invite_code';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class AdvisingRepository implements AdvisingStore {
  private readonly logger = new Logger(AdvisingRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  private fail(action: string, message: string): never {
    this.logger.error(`${action} failed: ${message}`);
    throw new InternalServerErrorException(
      'Something went wrong. Please try again.',
    );
  }

  async getProfile(id: string): Promise<AdvisingProfile | null> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.fail('Profile lookup', error.message);
    }
    return (data as AdvisingProfile | null) ?? null;
  }

  async findAdvisorByCode(code: string): Promise<AdvisingProfile | null> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select(COLUMNS)
      .eq('invite_code', code)
      .eq('role', 'advisor')
      .maybeSingle();
    if (error) {
      this.fail('Code lookup', error.message);
    }
    return (data as AdvisingProfile | null) ?? null;
  }

  async setAdvisor(studentId: string, advisorId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('profiles')
      .update({ advisor_id: advisorId })
      .eq('id', studentId)
      .eq('role', 'student');
    if (error) {
      this.fail('Linking', error.message);
    }
  }

  async setInviteCode(advisorId: string, code: string): Promise<'ok' | 'taken'> {
    const { error } = await this.supabase.admin
      .from('profiles')
      .update({ invite_code: code })
      .eq('id', advisorId)
      .eq('role', 'advisor');
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return 'taken';
      }
      this.fail('Saving the code', error.message);
    }
    return 'ok';
  }

  async unlinkStudent(advisorId: string, studentId: string): Promise<boolean> {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .update({ advisor_id: null })
      .eq('id', studentId)
      .eq('advisor_id', advisorId)
      .eq('role', 'student')
      .select('id');
    if (error) {
      this.fail('Removing the student', error.message);
    }
    return Array.isArray(data) && data.length > 0;
  }
}
