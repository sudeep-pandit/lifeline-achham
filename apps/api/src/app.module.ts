import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import configuration from "./config/configuration";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { NepalDataModule } from "./nepal-data/nepal-data.module";
import { MembershipTypesModule } from "./membership-types/membership-types.module";
import { ApplicationsModule } from "./applications/applications.module";
import { MembersModule } from "./members/members.module";
import { PaymentsModule } from "./payments/payments.module";
import { DocumentsModule } from "./documents/documents.module";
import { VerifyModule } from "./verify/verify.module";
import { FinanceModule } from "./finance/finance.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { BackupsModule } from "./backups/backups.module";
import { AiAssistantModule } from "./ai-assistant/ai-assistant.module";
import { HealthModule } from "./health/health.module";
import { DocumentTemplatesModule } from "./document-templates/document-templates.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { AuditLogInterceptor } from "./common/interceptors/audit-log.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL ?? 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX ?? 100),
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    OrganizationsModule,
    AuditLogModule,
    DashboardModule,
    NepalDataModule,
    MembershipTypesModule,
    ApplicationsModule,
    MembersModule,
    PaymentsModule,
    DocumentsModule,
    VerifyModule,
    FinanceModule,
    ReportsModule,
    NotificationsModule,
    BackupsModule,
    AiAssistantModule,
    HealthModule,
    DocumentTemplatesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Order matters: authenticate first, then check fine-grained permissions.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    Reflector,
  ],
})
export class AppModule {}
