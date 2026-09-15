import { IsIn, IsUUID } from "class-validator";

export class InitiatePaymentDto {
  @IsUUID()
  applicationId!: string;

  @IsIn(["ESEWA", "KHALTI", "CONNECTIPS"])
  method!: "ESEWA" | "KHALTI" | "CONNECTIPS";
}
