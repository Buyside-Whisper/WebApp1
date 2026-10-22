import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class ReceiptLineDto {
  @IsOptional()
  @IsUUID()
  productId!: string | null;

  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'quantity must be a number with at most 3 decimals' })
  @Min(0.001, { message: 'quantity must be more than 0' })
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'unitCost must be a number with at most 2 decimals' })
  @Min(0)
  unitCost!: number;
}

export class SaveReceiptDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  waybillNumber?: string | null;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  note?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines!: ReceiptLineDto[];
}

export class CreateReceiptFromRsDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsBoolean()
  createSupplier?: boolean;
}
