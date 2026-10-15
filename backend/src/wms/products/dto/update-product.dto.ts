import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ProductPosStatus } from '../product-pos-status.enum.js';
import { ProductStatus } from '../product-status.enum.js';
import { ProductUnit } from '../product-unit.enum.js';
import { ProductUsage } from '../product-usage.enum.js';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barcode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  group?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  supplier?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductUsage)
  usage?: ProductUsage;

  @IsOptional()
  @IsEnum(ProductPosStatus)
  posStatus?: ProductPosStatus;

  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'costPrice must be a number with at most 2 decimals' })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'salePrice must be a number with at most 2 decimals' })
  @Min(0)
  salePrice?: number;
}
