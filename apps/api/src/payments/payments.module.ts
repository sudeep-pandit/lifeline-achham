import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { OrganizationsModule } from "../organizations/organizations.module";
import { EsewaGatewayService } from "./gateways/esewa-gateway.service";
import { KhaltiGatewayService } from "./gateways/khalti-gateway.service";
import { ConnectIpsGatewayService } from "./gateways/connectips-gateway.service";
import { GatewayRegistryService } from "./gateways/gateway-registry.service";

@Module({
  imports: [OrganizationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    EsewaGatewayService,
    KhaltiGatewayService,
    ConnectIpsGatewayService,
    GatewayRegistryService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
