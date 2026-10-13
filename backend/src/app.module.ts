import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdvisingModule } from './advising/advising.module.js';
import { AdvisorModule } from './advisor/advisor.module.js';
import { ChatModule } from './chat/chat.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { ScreeningModule } from './screening/screening.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    ScreeningModule,
    AdvisorModule,
    AdvisingModule,
    ProfileModule,
    ChatModule,
  ],
})
export class AppModule {}
