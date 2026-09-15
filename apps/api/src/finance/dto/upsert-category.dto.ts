import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class UpsertCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
