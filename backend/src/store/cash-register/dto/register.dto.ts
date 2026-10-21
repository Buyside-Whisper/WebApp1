import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

export class OpenRegisterDto {
  @IsUUID()
  storeId!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  registerNo!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  openingCash!: number;
}

export class CloseRegisterDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  closingCash!: number;
}
