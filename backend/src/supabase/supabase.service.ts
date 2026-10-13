import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  /**
   * Admin client. It uses the secret key and bypasses Row Level Security, so
   * it must only ever exist on the backend. Every query made with it has to
   * filter by the signed-in user's id explicitly.
   */
  readonly admin: SupabaseClient;

  constructor(config: ConfigService) {
    this.admin = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
}
