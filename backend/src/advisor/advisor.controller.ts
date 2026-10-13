import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AdvisorService } from './advisor.service.js';
import type { AdvisorDashboard } from './advisor.service.js';
import type { AdviseeDetail } from './advisor.view.js';

@Controller('advisor')
@UseGuards(AuthGuard)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  /** GET /advisor/students — overview numbers and the advisee list. */
  @Get('students')
  dashboard(@CurrentUser() user: AuthUser): Promise<AdvisorDashboard> {
    return this.advisorService.dashboard(user);
  }

  /** GET /advisor/students/:id — one advisee and their screening history. */
  @Get('students/:id')
  student(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdviseeDetail> {
    return this.advisorService.student(user, id);
  }
}
