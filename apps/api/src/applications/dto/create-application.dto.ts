import { Type } from "class-transformer";
import {
  IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional,
  IsString, IsUUID, Min, ValidateNested,
} from "class-validator";

class SocialLinkDto {
  @IsString() platform!: string;
  @IsString() url!: string;
}

// Public membership application submission (Section 8). Deliberately does
// NOT accept organizationId from the client for anything but routing in a
// future multi-tenant deployment - all writes are scoped server-side.
export class CreateApplicationDto {
  @IsString()
  fullName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEnum(["MALE", "FEMALE", "OTHER"])
  gender!: "MALE" | "FEMALE" | "OTHER";

  @IsUUID()
  districtId!: string;

  @IsUUID()
  municipalityId!: string;

  @IsInt()
  @Min(1)
  wardNo!: number;

  @IsOptional()
  @IsString()
  tole?: string;

  @IsEmail()
  email!: string;

  @IsString()
  mobile!: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsUUID()
  membershipTypeId!: string;
}
