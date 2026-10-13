import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { InviteCodeDto } from './advising.dto.js';
import type { AdvisorSummary } from './advising.logic.js';
import { AdvisingService } from './advising.service.js';

@Controller('advising')
@UseGuards(AuthGuard)
export class AdvisingController {
  constructor(private readonly advisingService: AdvisingService) {}

  /* ------------------------------ Students ------------------------------ */

  /** GET /advising/advisor — the signed-in student's advisor, or null. */
  @Get('advisor')
  myAdvisor(
    @CurrentUser() user: AuthUser,
  ): Promise<{ advisor: AdvisorSummary | null }> {
    return this.advisingService.myAdvisor(user);
  }

  /** POST /advising/preview — whose code is this? Does not link anything. */
  @Post('preview')
  @HttpCode(200)
  preview(
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteCodeDto,
  ): Promise<{ advisor: { fullName: string } }> {
    return this.advisingService.preview(user, dto.code);
  }

  /** POST /advising/join — link the student to the code's advisor. */
  @Post('join')
  @HttpCode(200)
  join(
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteCodeDto,
  ): Promise<{ advisor: AdvisorSummary }> {
    return this.advisingService.join(user, dto.code);
  }

  /* ------------------------------ Advisors ------------------------------ */

  /** GET /advising/code — the advisor's invite code (created on first use). */
  @Get('code')
  code(@CurrentUser() user: AuthUser): Promise<{ code: string }> {
    return this.advisingService.code(user);
  }

  /** POST /advising/code/regenerate — replace the code; the old one stops working. */
  @Post('code/regenerate')
  @HttpCode(200)
  regenerate(@CurrentUser() user: AuthUser): Promise<{ code: string }> {
    return this.advisingService.regenerate(user);
  }

  /** DELETE /advising/students/:id — remove a student from the advisor's list. */
  @Delete('students/:id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ removed: true }> {
    return this.advisingService.remove(user, id);
  }
}
