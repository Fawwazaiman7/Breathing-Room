import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { NASA_TLX_DIMENSIONS } from '../screening.types.js';
import type { NasaTlxDimension } from '../screening.types.js';

class NasaTlxRatingsDto implements Record<NasaTlxDimension, number> {
  @IsNumber()
  @Min(0)
  @Max(100)
  mentalDemand!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  physicalDemand!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  temporalDemand!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  performance!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  effort!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  frustration!: number;
}

class NasaTlxInputDto {
  @IsArray()
  @IsIn(NASA_TLX_DIMENSIONS, { each: true })
  pairwiseChoices!: NasaTlxDimension[];

  @ValidateNested()
  @Type(() => NasaTlxRatingsDto)
  ratings!: NasaTlxRatingsDto;
}

class OlbiInputDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4, { each: true })
  answers!: number[];
}

export class EvaluateScreeningDto {
  @ValidateNested()
  @Type(() => NasaTlxInputDto)
  nasaTlx!: NasaTlxInputDto;

  @ValidateNested()
  @Type(() => OlbiInputDto)
  olbi!: OlbiInputDto;
}
