import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CheckoutInstructions, PaymentGatewayProvider, VerificationResult } from "./payment-gateway.interface";

// Khalti integration scaffold (KPG-2 style: server-initiated, secret-key
// authenticated). CONFIRM endpoint paths, field names and the amount unit
// (Khalti historically expects paisa, i.e. amount * 100) against Khalti's
// current official merchant documentation before going live.
@Injectable()
export class KhaltiGatewayService implements PaymentGatewayProvider {
  readonly method = "KHALTI";
  private readonly logger = new Logger(KhaltiGatewayService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const c = this.config.get("payments.khalti");
    return Boolean(c?.secretKey && c?.verifyUrl);
  }

  buildCheckout(params: { paymentNumber: string; amount: string; successUrl: string; failureUrl: string }): CheckoutInstructions {
    if (!this.isConfigured()) {
      throw new Error("Khalti is not configured (missing KHALTI_SECRET_KEY / KHALTI_VERIFY_URL).");
    }

    // Real integration: POST to Khalti's "initiate" endpoint server-side
    // with the secret key, receive a `payment_url` to redirect the payer
    // to. Left as a documented next call rather than faked here, since it
    // requires a live secret key to actually respond.
    return {
      method: this.method,
      purchaseOrderId: params.paymentNumber,
      amountPaisa: Math.round(Number(params.amount) * 100),
      returnUrl: params.successUrl,
      note: "Call Khalti's initiate endpoint server-side with this payload to obtain the redirect payment_url.",
    };
  }

  async verifyTransaction(reference: string): Promise<VerificationResult> {
    const c = this.config.get("payments.khalti");
    if (!this.isConfigured()) {
      return { verified: false, rawPayload: null, failureReason: "Khalti is not configured on this server." };
    }

    try {
      const res = await fetch(c.verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${c.secretKey}`,
        },
        body: JSON.stringify({ pidx: reference }),
      });
      const body = await res.json();

      // Confirm the exact success status string ("Completed") against
      // Khalti's current lookup-response documentation.
      const verified = res.ok && body?.status === "Completed";
      return { verified, gatewayReference: reference, rawPayload: body, failureReason: verified ? undefined : body?.status };
    } catch (err) {
      this.logger.error(`Khalti verification failed for ${reference}`, err as Error);
      return { verified: false, rawPayload: { error: String(err) }, failureReason: "Verification request failed" };
    }
  }
}
