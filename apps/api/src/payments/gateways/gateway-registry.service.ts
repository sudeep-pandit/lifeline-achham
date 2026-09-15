import { Injectable } from "@nestjs/common";
import { EsewaGatewayService } from "./esewa-gateway.service";
import { KhaltiGatewayService } from "./khalti-gateway.service";
import { ConnectIpsGatewayService } from "./connectips-gateway.service";
import type { PaymentGatewayProvider } from "./payment-gateway.interface";

// Adding a new online gateway later = write one class implementing
// PaymentGatewayProvider + register it here. Nothing in PaymentsService or
// the controller needs to change (Section 10: "Make payment integrations
// modular so additional gateways can be added later").
@Injectable()
export class GatewayRegistryService {
  private readonly providers: Record<string, PaymentGatewayProvider>;

  constructor(
    esewa: EsewaGatewayService,
    khalti: KhaltiGatewayService,
    connectips: ConnectIpsGatewayService,
  ) {
    this.providers = {
      ESEWA: esewa,
      KHALTI: khalti,
      CONNECTIPS: connectips,
    };
  }

  get(method: string): PaymentGatewayProvider | undefined {
    return this.providers[method];
  }

  isOnlineMethod(method: string): boolean {
    return method in this.providers;
  }

  availableMethods(): { method: string; configured: boolean }[] {
    return Object.values(this.providers).map((p) => ({ method: p.method, configured: p.isConfigured() }));
  }
}
