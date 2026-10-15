import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ProductPosStatus } from '../product-pos-status.enum.js';
import { ProductStatus } from '../product-status.enum.js';
import { ProductUnit } from '../product-unit.enum.js';
import { ProductUsage } from '../product-usage.enum.js';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  group!: string;

  @IsString()
  @IsNotEmpty()
  supplier!: string;

  @IsEnum(ProductStatus)
  status!: ProductStatus;

  @IsEnum(ProductUsage)
  usage!: ProductUsage;

  @IsEnum(ProductPosStatus)
  posStatus!: ProductPosStatus;

  @IsEnum(ProductUnit)
  unit!: ProductUnit;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'costPrice must be a number with at most 2 decimals' })
  @Min(0)
  costPrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'salePrice must be a number with at most 2 decimals' })
  @Min(0)
  salePrice!: number;
}
