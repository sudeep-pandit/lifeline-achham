import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CheckoutInstructions, PaymentGatewayProvider, VerificationResult } from "./payment-gateway.interface";

// ConnectIPS integration scaffold. ConnectIPS uses a merchant certificate +
// token-based request signing (PKCS7/JWT depending on integration mode),
// which needs the actual merchant onboarding artifacts (P12 certificate,
// creditor's merchant ID/app credentials from the bank) to implement for
// real. This class defines the integration point cleanly; CONFIRM the
// signing/verification contract against ConnectIPS's current merchant
// integration guide before going live.
@Injectable()
export class ConnectIpsGatewayService implements PaymentGatewayProvider {
  readonly method = "CONNECTIPS";
  private readonly logger = new Logger(ConnectIpsGatewayService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const c = this.config.get("payments.connectips");
    return Boolean(c?.merchantId && c?.appId && c?.appName);
  }

  buildCheckout(params: { paymentNumber: string; amount: string; successUrl: string; failureUrl: string }): CheckoutInstructions {
    if (!this.isConfigured()) {
      throw new Error("ConnectIPS is not configured (missing CONNECTIPS_MERCHANT_ID / CONNECTIPS_APP_ID / CONNECTIPS_APP_NAME).");
    }

    return {
      method: this.method,
      transactionId: params.paymentNumber,
      amount: params.amount,
      note: "Requires signing this request with the merchant's onboarded certificate before redirecting - not implemented without real merchant credentials.",
    };
  }

  async verifyTransaction(reference: string): Promise<VerificationResult> {
    this.logger.warn(`ConnectIPS verifyTransaction called for ${reference} but no live integration is configured.`);
    return {
      verified: false,
      rawPayload: null,
      failureReason: "ConnectIPS verification requires merchant certificate credentials not present on this server.",
    };
  }
}
