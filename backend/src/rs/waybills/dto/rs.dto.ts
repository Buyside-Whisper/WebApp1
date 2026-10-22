import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SaveRsConnectionDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  password!: string;
}

export class RsPeriodQueryDto {
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  refresh?: boolean;
}
