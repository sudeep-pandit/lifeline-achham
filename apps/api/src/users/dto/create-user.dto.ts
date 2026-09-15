import { ArrayNotEmpty, IsArray, IsEmail, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsArray()
  @ArrayNotEmpty()
  roleIds!: string[];
}
