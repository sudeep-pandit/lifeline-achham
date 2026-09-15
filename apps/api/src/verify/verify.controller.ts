import { Controller, Get, Param } from "@nestjs/common";
import { VerifyService } from "./verify.service";
import { Public } from "../common/decorators/public.decorator";

@Controller("verify")
@Public()
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  @Get("member/:memberId")
  member(@Param("memberId") memberId: string) {
    return this.verifyService.verifyMember(memberId);
  }

  @Get("certificate/:certificateNumber")
  certificate(@Param("certificateNumber") certificateNumber: string) {
    return this.verifyService.verifyCertificate(certificateNumber);
  }

  @Get("receipt/:receiptNumber")
  receipt(@Param("receiptNumber") receiptNumber: string) {
    return this.verifyService.verifyReceipt(receiptNumber);
  }

  @Get("application/:applicationNumber")
  application(@Param("applicationNumber") applicationNumber: string) {
    return this.verifyService.verifyApplication(applicationNumber);
  }
}
