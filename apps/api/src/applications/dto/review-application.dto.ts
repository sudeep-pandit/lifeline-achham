import { IsIn, IsOptional, IsString } from "class-validator";

export class ReviewApplicationDto {
  @IsIn(["APPROVE", "REJECT", "REQUEST_CORRECTION"])
  action!: "APPROVE" | "REJECT" | "REQUEST_CORRECTION";

  @IsOptional()
  @IsString()
  remarks?: string;
}
