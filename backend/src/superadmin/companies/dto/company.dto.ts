import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { AppModuleName } from '../../../companies/app-module.enum.js';
import { CompanyStatus } from '../../../companies/company-status.enum.js';
import { LegalForm } from '../../../companies/legal-form.enum.js';
import { PaymentMethod } from '../payment-method.enum.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const CODE = /^(\d{9}|\d{11})$/;

export class CreateCompanyDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName!: string;

  @IsEnum(LegalForm)
  legalForm!: LegalForm;

  @Transform(trim)
  @Matches(CODE, { message: 'The identification code has 9 digits (11 for an individual entrepreneur)' })
  identificationCode!: string;

  @IsBoolean()
  vatPayer!: boolean;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  legalAddress!: string;

  @Transform(trim)
  @IsEmail()
  contactEmail!: string;

  @Transform(trim)
  @Matches(PHONE, { message: 'contactPhone must be a phone number' })
  contactPhone!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  adminFirstName!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  adminLastName!: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(AppModuleName, { each: true })
  modules!: AppModuleName[];

  @IsObject()
  modulePrices!: Partial<Record<AppModuleName, number>>;

  @Matches(DATE, { message: 'subscriptionStart must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  subscriptionStart!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @Matches(DATE, { message: 'trialEndsOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  trialEndsOn?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateCompanyDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsEnum(LegalForm)
  legalForm?: LegalForm;

  @IsOptional()
  @Transform(trim)
  @Matches(CODE, { message: 'The identification code has 9 digits (11 for an individual entrepreneur)' })
  identificationCode?: string;

  @IsOptional()
  @IsBoolean()
  vatPayer?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  legalAddress?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(PHONE, { message: 'contactPhone must be a phone number' })
  contactPhone?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(AppModuleName, { each: true })
  modules?: AppModuleName[];

  @IsOptional()
  @IsObject()
  modulePrices?: Partial<Record<AppModuleName, number>>;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @IsOptional()
  @Matches(DATE, { message: 'subscriptionStart must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  subscriptionStart?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @Matches(DATE, { message: 'trialEndsOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  trialEndsOn?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class CreatePaymentDto {
  @Matches(DATE, { message: 'paidOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  paidOn!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with at most 2 decimals' })
  @Min(0.01)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @Matches(DATE, { message: 'periodFrom must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  periodFrom!: string;

  @Matches(DATE, { message: 'periodTo must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  periodTo!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
