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

  // Optional: only set when the employee leaves (or is about to).
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string | null;

  // Leave out for a person who has no access to the app.
  @IsOptional()
  @IsEnum(EmployeeRole)
  role?: EmployeeRole | null;

  // Required for admin / manager / cashier (checked in the service). A module admin's own
  // module is used regardless of what is sent.
  @IsOptional()
  @IsEnum(AppModuleName)
  module?: AppModuleName | null;

  // Only used when a manager adds someone: the stores (Store manager) or warehouses (WMS
  // manager) of his that the person works in.
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  workplaceIds?: string[];
}
