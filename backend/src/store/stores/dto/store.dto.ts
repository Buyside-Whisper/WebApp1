import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateStoreDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  registers?: number;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

}

export class UpdateStoreDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  registers?: number;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

}
