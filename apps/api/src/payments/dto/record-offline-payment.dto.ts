import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class RecordOfflinePaymentDto {
  @IsUUID()
  applicationId!: string;

  @IsIn(["CASH", "BANK_DEPOSIT", "CHEQUE", "OTHER"])
  method!: "CASH" | "BANK_DEPOSIT" | "CHEQUE" | "OTHER";

  @IsOptional()
  @IsString()
  offlineReference?: string; // cheque no. / deposit slip no.

  @IsOptional()
  @IsString()
  remarks?: string;
}
