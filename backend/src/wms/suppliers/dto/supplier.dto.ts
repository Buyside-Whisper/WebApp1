import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SupplierStatus } from '../supplier-status.enum.js';
import { SupplierType } from '../supplier-type.enum.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateSupplierDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  name!: string;

  @IsEnum(SupplierType)
  type!: SupplierType;

  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^(\d{9}|\d{11})$/, { message: 'The identification code has 9 digits (company) or 11 digits (personal ID)' })
  identificationCode?: string | null;

  @IsOptional()
  @IsBoolean()
  vatPayer?: boolean;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(120)
  contactPerson?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(240)
  address?: string | null;

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;
}

export class UpdateSupplierDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsEnum(SupplierType)
  type?: SupplierType;

  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^(\d{9}|\d{11})$/, { message: 'The identification code has 9 digits (company) or 11 digits (personal ID)' })
  identificationCode?: string | null;

  @IsOptional()
  @IsBoolean()
  vatPayer?: boolean;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(120)
  contactPerson?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @Matches(/^\+?[0-9 ()-]{7,20}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(240)
  address?: string | null;

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;
}
