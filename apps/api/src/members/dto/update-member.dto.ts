import { Type } from "class-transformer";
import {
  IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional,
  IsString, IsUUID, Min, ValidateNested,
} from "class-validator";

class SocialLinkDto {
  @IsString() platform!: string;
  @IsString() url!: string;
}

// Full edit capability - identity and membership fields ARE editable here
// (a deliberate change from Phase 2's original "contact fields only"
// scope, which proved too restrictive for correcting real data-entry
// mistakes or handling a membership type change). Changing membershipTypeId
// recomputes membershipPrice/expiresAt in the service layer; every change
// still goes through the normal members.edit permission and gets audited
// the same as before - broader editability doesn't mean less oversight.
export class UpdateMemberDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsEnum(["MALE", "FEMALE", "OTHER"]) gender?: "MALE" | "FEMALE" | "OTHER";
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() countryCode?: string;
  @IsOptional() @IsUUID() districtId?: string;
  @IsOptional() @IsUUID() municipalityId?: string;
  @IsOptional() @IsInt() @Min(1) wardNo?: number;
  @IsOptional() @IsString() tole?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsUUID() membershipTypeId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];
  // Send an empty string to remove the photo, a data URL to replace it,
  // or omit the field entirely to leave it unchanged.
  @IsOptional() @IsString() profilePhotoUrl?: string;
}
