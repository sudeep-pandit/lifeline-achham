import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { RecordOfflinePaymentDto } from "./dto/record-offline-payment.dto";
import { CreateMemberBillDto } from "./dto/create-member-bill.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Audit } from "../common/decorators/audit.decorator";
import type { AuthUser } from "@lifeline/types";
import type { PaymentStatus } from "@prisma/client";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  // Public: lets the application form show which online methods are
  // actually usable right now, instead of showing dead buttons.
  @Public()
  @Get("public/methods")
  availableMethods() {
    return this.paymentsService.availableOnlineMethods();
  }

  @Public()
  @Post("public/initiate")
  @Audit({ action: "payment.initiate", module: "payments" })
  initiate(@Query("organizationId") organizationId: string | undefined, @Body() dto: InitiatePaymentDto) {
    const webUrl = this.config.get<string>("webUrl");
    return this.paymentsService.initiateOnline(organizationId || DEFAULT_ORG_ID, dto, {
      successUrl: `${webUrl}/apply/payment-result?status=success`,
      failureUrl: `${webUrl}/apply/payment-result?status=failure`,
    });
  }

  // Public: the gateway redirects the payer's browser back here (or the
  // frontend calls this immediately on landing on the result page) with
  // the gateway's own reference. This endpoint then calls the gateway's
  // SERVER-SIDE verification API - the redirect itself proves nothing
  // (Section 10).
  @Public()
  @Post("public/:id/verify")
  @Audit({ action: "payment.verify_online", module: "payments" })
  verifyOnline(@Param("id") id: string, @Body("gatewayReference") gatewayReference: string) {
    return this.paymentsService.verifyOnline(DEFAULT_ORG_ID, id, gatewayReference);
  }

  @Post()
  @RequirePermissions("payments.create")
  @Audit({ action: "payment.record_offline", module: "payments" })
  recordOffline(@CurrentUser() user: AuthUser, @Body() dto: RecordOfflinePaymentDto) {
    return this.paymentsService.recordOffline(user.organizationId, user.id, dto);
  }

  @Patch(":id/verify")
  @RequirePermissions("payments.verify")
  @Audit({ action: "payment.verify_offline", module: "payments" })
  verifyOffline(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyOffline(user.organizationId, user.id, id, dto);
  }

  @Patch(":id/refund")
  @RequirePermissions("payments.refund")
  @Audit({ action: "payment.refund", module: "payments" })
  refund(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body("remarks") remarks?: string) {
    return this.paymentsService.refund(user.organizationId, user.id, id, remarks);
  }

  // --- Billing (direct member, no online application) ---

  @Post("member-bill")
  @RequirePermissions("payments.create")
  @Audit({ action: "payment.create_member_bill", module: "payments" })
  createMemberBill(@CurrentUser() user: AuthUser, @Body() dto: CreateMemberBillDto) {
    return this.paymentsService.createMemberBill(user.organizationId, user.id, dto);
  }

  @Patch("member-bill/:id/verify")
  @RequirePermissions("payments.verify")
  @Audit({ action: "payment.verify_member_bill", module: "payments" })
  verifyMemberBill(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyMemberBill(user.organizationId, user.id, id, dto);
  }

  @Get("member/:memberId")
  @RequirePermissions("payments.view")
  billsForMember(@CurrentUser() user: AuthUser, @Param("memberId") memberId: string) {
    return this.paymentsService.billsForMember(user.organizationId, memberId);
  }

  @Get()
  @RequirePermissions("payments.view")
  findAll(@CurrentUser() user: AuthUser, @Query("status") status?: PaymentStatus) {
    return this.paymentsService.findAll(user.organizationId, status);
  }

  @Get(":id")
  @RequirePermissions("payments.view")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.paymentsService.findOne(user.organizationId, id);
  }
}
