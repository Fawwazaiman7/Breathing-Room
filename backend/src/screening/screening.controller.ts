import {
  Body,
  Controller,
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
import { EvaluateScreeningDto } from './dto/evaluate-screening.dto.js';
import { toStudentView } from './screening.evaluator.js';
import type { StudentScreeningView } from './screening.evaluator.js';
import type { ScreeningHistoryItem } from './screening.mapper.js';
import { ScreeningService } from './screening.service.js';
import type {
  ScreeningFeedback,
  SubmittedScreening,
} from './screening.service.js';

@Controller('screening')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  /**
   * POST /screening/evaluate
   * Calculation only: no login, nothing saved. Handy while developing;
   * remove it before real students use the system.
   */
  @Post('evaluate')
  @HttpCode(200)
  evaluate(@Body() dto: EvaluateScreeningDto): StudentScreeningView {
    return toStudentView(this.screeningService.evaluate(dto));
  }

  /** POST /screening — evaluate and save for the signed-in student. */
  @Post()
  @UseGuards(AuthGuard)
  submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: EvaluateScreeningDto,
  ): Promise<SubmittedScreening> {
    return this.screeningService.submit(user, dto);
  }

  /** GET /screening/mine — the signed-in student's past screenings. */
  @Get('mine')
  @UseGuards(AuthGuard)
  history(@CurrentUser() user: AuthUser): Promise<ScreeningHistoryItem[]> {
    return this.screeningService.history(user);
  }

  /**
   * POST /screening/:id/feedback — the "A note for you" text for one of the
   * signed-in student's screenings. Generated once, then served from the
   * database.
   */
  @Post(':id/feedback')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  feedback(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ScreeningFeedback> {
    return this.screeningService.feedback(user, id);
  }
}
