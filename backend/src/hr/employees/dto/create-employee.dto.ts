import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { AppModuleName } from '../../../companies/app-module.enum.js';
import { EmployeeRole } from '../employee-role.enum.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEmployeeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @Transform(trim)
  @Matches(/^\d{11}$/, { message: 'personalId must be exactly 11 digits' })
  personalId!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @Transform(trim)
  @Matches(/^\+?[0-9 ()-]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD' })
  birthDate!: string;

  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hireDate must be YYYY-MM-DD' })
  hireDate!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string | null;

  @IsOptional()
  @IsEnum(EmployeeRole)
  role?: EmployeeRole | null;

  @IsOptional()
  @IsEnum(AppModuleName)
  module?: AppModuleName | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  workplaceIds?: string[];
}
