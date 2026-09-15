import { IsOptional, IsString } from "class-validator";

export class VerifyPaymentDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
