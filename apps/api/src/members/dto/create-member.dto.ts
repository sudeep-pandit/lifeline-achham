import { Type } from "class-transformer";
import {
  IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional,
  IsString, IsUUID, Min, ValidateNested,
} from "class-validator";

class SocialLinkDto {
  @IsString() platform!: string;
  @IsString() url!: string;
}

// Section 6/8's staff role includes "Member registration" as a distinct
// capability from the public application flow (Section 8) - this is that
// direct path: a staff member enters everything themselves for a walk-in
// registration, no online application or online payment involved. This
// intentionally does NOT create a Payment/Income row automatically -
// Section 48 requires financial records to be deliberate, so if the
// walk-in paid, staff record that separately via the Finance page (an
// extra click, but it means every income entry is something a human
// actually chose to log, not something inferred on their behalf).
export class CreateMemberDto {
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
  @IsString()
  bloodGroup?: string;

  // Base64 data URL (e.g. "data:image/jpeg;base64,..."), validated for
  // size/type in the service layer - see MembersService.validatePhoto().
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsUUID()
  membershipTypeId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
