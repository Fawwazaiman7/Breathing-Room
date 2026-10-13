import { IsString, Length } from 'class-validator';

export class InviteCodeDto {
  /** The code as typed; case, spaces, and dashes are ignored. */
  @IsString()
  @Length(1, 32)
  code!: string;
}
