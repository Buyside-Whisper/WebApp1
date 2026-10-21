import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { WarehouseStatus } from '../warehouse-status.enum.js';
import { WarehouseType } from '../warehouse-type.enum.js';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsString()
  branch?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}
