import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { AppModuleName } from '../../../companies/app-module.enum.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCompanyDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name!: string;

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
}

export class UpdateCompanyDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(AppModuleName, { each: true })
  modules?: AppModuleName[];
}
