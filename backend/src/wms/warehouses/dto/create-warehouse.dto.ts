import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { WarehouseStatus } from '../warehouse-status.enum.js';
import { WarehouseType } from '../warehouse-type.enum.js';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(WarehouseType)
  type!: WarehouseType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsString()
  branch?: string | null;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}
