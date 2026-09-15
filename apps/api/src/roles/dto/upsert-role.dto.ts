import { ArrayNotEmpty, IsArray, IsOptional, IsString } from "class-validator";

export class UpsertRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  permissionKeys!: string[];
}
