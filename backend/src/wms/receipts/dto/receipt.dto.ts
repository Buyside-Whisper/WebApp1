import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
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
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReceiptLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'quantity must be a number with at most 3 decimals' })
  @Min(0.001, { message: 'quantity must be more than 0' })
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'unitCost must be a number with at most 2 decimals' })
  @Min(0)
  unitCost!: number;
}

// Saving a draft: everything may still be incomplete except the warehouse, supplier and date.
export class SaveReceiptDto {
  @IsUUID()
  warehouseId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  supplier!: string;

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
