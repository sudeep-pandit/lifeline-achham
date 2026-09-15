// =============================================================================
// Canonical permission catalogue (Section 4 of the spec).
// This is the SINGLE source of truth for permission keys. Both the API
// (seeding + guards) and the web app (menu visibility, UI gating) import
// this file so permissions are never hard-coded in two places.
// =============================================================================

export const PERMISSION_MODULES = [
  "members",
  "applications",
  "membership_types",
  "payments",
  "receipts",
  "documents",
  "finance",
  "reports",
  "users",
  "roles",
  "settings",
  "backups",
  "audit_logs",
  "notifications",
  "ai_assistant",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

// Every permission key in the system. Keep this list flat and explicit
// (no wildcards) so grants are always auditable.
export const PERMISSIONS = [
  // Members
  { key: "members.view", module: "members", action: "view", description: "View member records" },
  { key: "members.create", module: "members", action: "create", description: "Register new members" },
  { key: "members.edit", module: "members", action: "edit", description: "Edit member records" },
  { key: "members.delete", module: "members", action: "delete", description: "Delete member records" },
  { key: "members.approve", module: "members", action: "approve", description: "Approve membership applications" },

  // Applications
  { key: "applications.view", module: "applications", action: "view", description: "View membership applications" },
  { key: "applications.review", module: "applications", action: "review", description: "Review pending applications" },

  // Membership types
  { key: "membership_types.manage", module: "membership_types", action: "manage", description: "Create/edit membership types" },

  // Payments
  { key: "payments.view", module: "payments", action: "view", description: "View payments" },
  { key: "payments.create", module: "payments", action: "create", description: "Record offline payments" },
  { key: "payments.verify", module: "payments", action: "verify", description: "Verify/reconcile payments" },
  { key: "payments.refund", module: "payments", action: "refund", description: "Issue refunds" },

  // Documents
  { key: "documents.cards", module: "documents", action: "cards", description: "Generate membership cards" },
  { key: "documents.certificates", module: "documents", action: "certificates", description: "Generate certificates" },
  { key: "documents.receipts", module: "documents", action: "receipts", description: "Generate receipts" },
  { key: "documents.temporary_registration", module: "documents", action: "temporary_registration", description: "Generate temporary registrations" },

  // Finance
  { key: "finance.income", module: "finance", action: "income", description: "Manage income records" },
  { key: "finance.expenses", module: "finance", action: "expenses", description: "Manage expense records" },
  { key: "finance.approve", module: "finance", action: "approve", description: "Approve income/expense entries" },

  // Reports
  { key: "reports.view", module: "reports", action: "view", description: "View reports" },
  { key: "reports.export", module: "reports", action: "export", description: "Export/print reports" },

  // Users & roles
  { key: "users.view", module: "users", action: "view", description: "View users" },
  { key: "users.create", module: "users", action: "create", description: "Create users" },
  { key: "users.edit", module: "users", action: "edit", description: "Edit users" },
  { key: "users.delete", module: "users", action: "delete", description: "Disable/delete users" },
  { key: "roles.manage", module: "roles", action: "manage", description: "Create/edit roles and assign permissions" },

  // Settings / backups / audit
  { key: "settings.manage", module: "settings", action: "manage", description: "Manage organization settings" },
  { key: "backups.manage", module: "backups", action: "manage", description: "Create/restore database backups" },
  { key: "audit_logs.view", module: "audit_logs", action: "view", description: "View audit logs" },

  // Notifications / AI
  { key: "notifications.manage", module: "notifications", action: "manage", description: "Manage notification templates" },
  { key: "ai_assistant.use", module: "ai_assistant", action: "use", description: "Use the AI assistant" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

// Default role -> permission mapping used by the seed script (Section 4).
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  "super-admin": PERMISSIONS.map((p) => p.key), // everything

  admin: [
    "members.view", "members.create", "members.edit", "members.approve",
    "applications.view", "applications.review",
    "membership_types.manage",
    "documents.cards", "documents.certificates", "documents.temporary_registration",
    "reports.view", "reports.export",
    "users.view", "users.create", "users.edit",
  ],

  accountant: [
    "payments.view", "payments.create", "payments.verify", "payments.refund",
    "documents.receipts",
    "finance.income", "finance.expenses", "finance.approve",
    "reports.view", "reports.export",
  ],

  staff: [
    "members.view", "members.create",
    "applications.view",
    "documents.temporary_registration",
  ],
};

export const DEFAULT_ROLES = [
  { name: "Super Admin", slug: "super-admin", description: "Full system access", isSystem: true },
  { name: "Admin", slug: "admin", description: "Manages members, applications, and documents", isSystem: true },
  { name: "Accountant", slug: "accountant", description: "Manages payments and finance", isSystem: true },
  { name: "Staff", slug: "staff", description: "Front-desk registration and search", isSystem: true },
] as const;
