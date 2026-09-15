import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

// Every field is optional so the settings screen can PATCH just what
// changed. Nothing in this module is hard-coded elsewhere in the app
// (Section 3) - every consumer reads through GET /organizations/settings.
export class UpdateSettingsDto {
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() panVatNumber?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() municipality?: string;
  @IsOptional() @IsString() ward?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() facebookUrl?: string;
  @IsOptional() @IsString() instagramUrl?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() dateFormat?: string;

  @IsOptional() @IsString() membershipIdPrefix?: string;
  @IsOptional() @IsString() receiptPrefix?: string;
  @IsOptional() @IsString() certificatePrefix?: string;
  @IsOptional() @IsString() cardPrefix?: string;
  @IsOptional() @IsString() temporaryRegPrefix?: string;
  @IsOptional() @IsString() expensePrefix?: string;
  @IsOptional() @IsString() incomePrefix?: string;
  @IsOptional() @IsString() paymentPrefix?: string;
  @IsOptional() @IsString() applicationPrefix?: string;

  @IsOptional() @IsString() watermarkText?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) watermarkOpacity?: number;
  @IsOptional() @IsBoolean() watermarkEnabled?: boolean;

  @IsOptional() @IsInt() @Min(1) expiringSoonDays?: number;
}
