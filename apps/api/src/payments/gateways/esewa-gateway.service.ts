import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import type { CheckoutInstructions, PaymentGatewayProvider, VerificationResult } from "./payment-gateway.interface";

// eSewa integration scaffold. The field names/signature scheme below follow
// eSewa's general v2 ePay pattern (merchant code, signed field set, HMAC-SHA256
// signature) at the time this was written - CONFIRM every field name, the
// exact signed-field list, and the verification endpoint contract against
// eSewa's current official merchant documentation before going live; payment
// gateway APIs change and this is not a substitute for that document.
@Injectable()
export class EsewaGatewayService implements PaymentGatewayProvider {
  readonly method = "ESEWA";
  private readonly logger = new Logger(EsewaGatewayService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const c = this.config.get("payments.esewa");
    return Boolean(c?.merchantCode && c?.secret && c?.verifyUrl);
  }

  buildCheckout(params: { paymentNumber: string; amount: string; successUrl: string; failureUrl: string }): CheckoutInstructions {
    const c = this.config.get("payments.esewa");
    if (!this.isConfigured()) {
      throw new Error("eSewa is not configured (missing ESEWA_MERCHANT_CODE / ESEWA_SECRET / ESEWA_VERIFY_URL).");
    }

    // Signed field set per eSewa's documented pattern: total_amount,
    // transaction_uuid, product_code are typically what gets HMAC-signed.
    const signedFieldNames = "total_amount,transaction_uuid,product_code";
    const message = `total_amount=${params.amount},transaction_uuid=${params.paymentNumber},product_code=${c.merchantCode}`;
    const signature = crypto.createHmac("sha256", c.secret).update(message).digest("base64");

    return {
      method: this.method,
      action: "https://rc-epay.esewa.com.np/api/epay/main/v2/form", // sandbox - replace with production URL
      fields: {
        amount: params.amount,
        total_amount: params.amount,
        transaction_uuid: params.paymentNumber,
        product_code: c.merchantCode,
        success_url: params.successUrl,
        failure_url: params.failureUrl,
        signed_field_names: signedFieldNames,
        signature,
      },
    };
  }

  async verifyTransaction(reference: string): Promise<VerificationResult> {
    const c = this.config.get("payments.esewa");
    if (!this.isConfigured()) {
      return { verified: false, rawPayload: null, failureReason: "eSewa is not configured on this server." };
    }

    try {
      const url = `${c.verifyUrl}?product_code=${c.merchantCode}&transaction_uuid=${reference}`;
      const res = await fetch(url);
      const body = await res.json();

      // eSewa's status verification response includes a "status" field;
      // confirm the exact success value ("COMPLETE") against current docs.
      const verified = res.ok && body?.status === "COMPLETE";
      return { verified, gatewayReference: reference, rawPayload: body, failureReason: verified ? undefined : body?.status };
    } catch (err) {
      this.logger.error(`eSewa verification failed for ${reference}`, err as Error);
      return { verified: false, rawPayload: { error: String(err) }, failureReason: "Verification request failed" };
    }
  }
}
