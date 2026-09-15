// Common contract every online payment gateway integration implements.
// Section 10: "Make payment integrations modular so additional gateways
// can be added later" - a new gateway is a new class implementing this
// interface plus one line in GatewayRegistryService, nothing else changes.

export interface CheckoutInstructions {
  // Everything the frontend needs to redirect the payer to the gateway (or
  // render its widget). Shape varies per gateway, hence the open index.
  method: string;
  [key: string]: unknown;
}

export interface VerificationResult {
  verified: boolean;
  gatewayReference?: string;
  rawPayload: unknown;
  failureReason?: string;
}

export interface PaymentGatewayProvider {
  readonly method: string;

  isConfigured(): boolean;

  /**
   * Builds whatever payload/redirect the frontend needs to send the payer
   * to the gateway. MUST NOT mark anything as paid - that only ever
   * happens in verifyTransaction(), called server-side.
   */
  buildCheckout(params: {
    paymentNumber: string;
    amount: string;
    successUrl: string;
    failureUrl: string;
  }): CheckoutInstructions;

  /**
   * Calls the gateway's OWN server-to-server verification endpoint using
   * the reference the gateway (not the browser redirect) provides.
   * Section 10: "Never mark online payments as successful based only on
   * the browser redirect."
   */
  verifyTransaction(reference: string): Promise<VerificationResult>;
}
