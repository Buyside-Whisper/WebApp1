import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { AppModuleName } from '../../../companies/app-module.enum.js';
import { EmployeeRole } from '../employee-role.enum.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Same fields and rules as CreateEmployeeDto, but every field is optional.
export class UpdateEmployeeDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{11}$/, { message: 'personalId must be exactly 11 digits' })
  personalId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\+?[0-9 ()-]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hireDate must be YYYY-MM-DD' })
  hireDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  position?: string;

  // null clears it (the employee is active again).
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
}
