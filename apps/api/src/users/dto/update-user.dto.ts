import { IsArray, IsEmail, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(["ACTIVE", "SUSPENDED", "DISABLED"]) status?: "ACTIVE" | "SUSPENDED" | "DISABLED";
  @IsOptional() @IsArray() roleIds?: string[];
}
