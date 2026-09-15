import { IsIn, IsOptional, IsString, IsUUID, IsNumber, Min } from "class-validator";

// Billing for an already-registered member with no online application on
// file (e.g. someone added directly via "Add Member") - the direct
// counterpart to RecordOfflinePaymentDto, which requires an application.
export class CreateMemberBillDto {
  @IsUUID()
  memberId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number; // defaults to the member's membershipPrice if omitted

  @IsIn(["CASH", "BANK_DEPOSIT", "CHEQUE", "OTHER"])
  method!: "CASH" | "BANK_DEPOSIT" | "CHEQUE" | "OTHER";

  @IsOptional()
  @IsString()
  offlineReference?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
