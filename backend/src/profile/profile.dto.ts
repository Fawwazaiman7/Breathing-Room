import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body of PATCH /profile. Any other property (role, advisor, invite code)
 * is removed by the global ValidationPipe before it reaches the service.
 * The detailed rules live in profile.logic.ts.
 */
export class UpdateProfileDto {
  @IsString()
  @MaxLength(300)
  fullName!: string;

  /** Students only; ignored for Academic Advisors. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  studentNumber?: string;

  /** Students only; ignored for Academic Advisors. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  className?: string;
}
