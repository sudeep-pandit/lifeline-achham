// Shared DTOs/types between apps/api and apps/web.
// Kept intentionally small in Phase 1; grows with each module.

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface AuthUser {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  isSuperAdmin: boolean;
  status: UserStatus;
  roles: string[];        // role slugs, e.g. ["admin"]
  permissions: string[];  // flattened permission keys, e.g. ["members.view", ...]
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  // refresh token is set as an HttpOnly cookie, never returned in the body
}

export interface OrganizationSettingsDto {
  id: string;
  name: string;
  logoUrl?: string | null;
  registrationNumber?: string | null;
  panVatNumber?: string | null;
  address?: string | null;
  district?: string | null;
  municipality?: string | null;
  ward?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  description?: string | null;
  currency: string;
  dateFormat: string;
  membershipIdPrefix: string;
  receiptPrefix: string;
  certificatePrefix: string;
  cardPrefix: string;
  temporaryRegPrefix: string;
  expensePrefix: string;
  incomePrefix: string;
  paymentPrefix: string;
  applicationPrefix: string;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkEnabled: boolean;
  expiringSoonDays: number;
}

export interface RoleDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
}

export interface UserListItemDto {
  id: string;
  fullName: string;
  email: string;
  status: UserStatus;
  roles: string[];
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  userName?: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// PHASE 2 — MEMBERSHIP
// -----------------------------------------------------------------------------

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type MemberStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
export type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "PAYMENT_PENDING" | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface DistrictDto {
  id: string;
  name: string;
}

export interface MunicipalityDto {
  id: string;
  districtId: string;
  name: string;
  type: "METROPOLITAN_CITY" | "SUB_METROPOLITAN_CITY" | "MUNICIPALITY" | "RURAL_MUNICIPALITY";
  wardCount: number;
}

export interface MembershipTypeDto {
  id: string;
  name: string;
  description?: string | null;
  price: string; // Decimal serialized as string over JSON
  durationDays?: number | null; // null = lifetime
  isActive: boolean;
  displayOrder: number;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface CreateApplicationRequest {
  fullName: string;
  dateOfBirth: string; // ISO date
  gender: Gender;
  districtId: string;
  municipalityId: string;
  wardNo: number;
  tole?: string;
  email: string;
  mobile: string;
  countryCode?: string;
  socialLinks?: SocialLink[];
  membershipTypeId: string;
}

export interface ApplicationListItemDto {
  id: string;
  applicationNumber: string;
  fullName: string;
  status: ApplicationStatus;
  membershipType: { name: string };
  district: { name: string };
  municipality: { name: string };
  createdAt: string;
}

export interface ReviewApplicationRequest {
  action: "APPROVE" | "REJECT" | "REQUEST_CORRECTION";
  remarks?: string;
}

export interface MemberListItemDto {
  id: string;
  memberId: string;
  fullName: string;
  email: string;
  mobile: string;
  bloodGroup?: string | null;
  profilePhotoUrl?: string | null;
  status: MemberStatus;
  membershipType: { name: string };
  district: { name: string };
  municipality: { name: string };
  membershipDate: string;
  expiresAt?: string | null;
}

export interface MemberDetailDto {
  id: string;
  memberId: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  email: string;
  mobile: string;
  countryCode: string;
  bloodGroup?: string | null;
  profilePhotoUrl?: string | null;
  wardNo: number;
  tole?: string | null;
  districtId: string;
  municipalityId: string;
  district: { name: string };
  municipality: { name: string };
  membershipTypeId: string;
  membershipType: { name: string; price: string; durationDays?: number | null };
  membershipDate: string;
  membershipPrice: string;
  expiresAt?: string | null;
  cardNumber?: string | null;
  certificateNumber?: string | null;
  remarks?: string | null;
  application?: { id: string; applicationNumber: string } | null;
}

export interface CreateMemberRequest {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  districtId: string;
  municipalityId: string;
  wardNo: number;
  tole?: string;
  email: string;
  mobile: string;
  countryCode?: string;
  bloodGroup?: string;
  profilePhotoUrl?: string;
  membershipTypeId: string;
  remarks?: string;
}

export interface ApplicationDetailDto {
  id: string;
  applicationNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  status: ApplicationStatus;
  email: string;
  mobile: string;
  countryCode: string;
  wardNo: number;
  tole?: string | null;
  membershipFee: string;
  membershipType: { name: string; price: string; durationDays?: number | null };
  district: { name: string };
  municipality: { name: string };
  reviewedBy?: { fullName: string } | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  createdAt: string;
  statusHistory: {
    id: string;
    fromStatus?: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    remarks?: string | null;
    changedBy?: { fullName: string } | null;
    createdAt: string;
  }[];
  member?: { memberId: string } | null;
  payments: PaymentListItemDto[];
}

// -----------------------------------------------------------------------------
// PHASE 3 — PAYMENTS
// -----------------------------------------------------------------------------

export type PaymentMethodType = "ESEWA" | "KHALTI" | "CONNECTIPS" | "CASH" | "BANK_DEPOSIT" | "CHEQUE" | "OTHER";
export type PaymentStatusType = "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "REFUNDED" | "MANUALLY_VERIFIED";

export const ONLINE_PAYMENT_METHODS: PaymentMethodType[] = ["ESEWA", "KHALTI", "CONNECTIPS"];
export const OFFLINE_PAYMENT_METHODS: PaymentMethodType[] = ["CASH", "BANK_DEPOSIT", "CHEQUE", "OTHER"];

export interface PaymentListItemDto {
  id: string;
  paymentNumber: string;
  amount: string;
  currency: string;
  method: PaymentMethodType;
  status: PaymentStatusType;
  offlineReference?: string | null;
  createdAt: string;
  application?: { id: string; applicationNumber: string; fullName: string };
  member?: { id: string; memberId: string; fullName: string };
}

export interface CreateMemberBillRequest {
  memberId: string;
  amount?: number;
  method: "CASH" | "BANK_DEPOSIT" | "CHEQUE" | "OTHER";
  offlineReference?: string;
  remarks?: string;
}

export interface PaymentDetailDto extends PaymentListItemDto {
  recordedBy?: { fullName: string } | null;
  verifiedBy?: { fullName: string } | null;
  verifiedAt?: string | null;
  remarks?: string | null;
  transactions: { id: string; direction: string; createdAt: string }[];
}

export interface RecordOfflinePaymentRequest {
  applicationId: string;
  method: "CASH" | "BANK_DEPOSIT" | "CHEQUE" | "OTHER";
  offlineReference?: string;
  remarks?: string;
}

export interface AvailableOnlineMethodDto {
  method: string;
  configured: boolean;
}

// -----------------------------------------------------------------------------
// PHASE 6 — REPORTS
// -----------------------------------------------------------------------------

export interface ReportColumnDto {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right";
}

export interface ReportDataDto {
  title: string;
  dateRangeLabel?: string;
  columns: ReportColumnDto[];
  rows: Record<string, string>[];
  summaryLines?: string[];
}

// -----------------------------------------------------------------------------
// PHASE 7 — ADVANCED
// -----------------------------------------------------------------------------

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export type BackupType = "MANUAL" | "AUTOMATIC";
export type BackupStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface BackupDto {
  id: string;
  type: BackupType;
  status: BackupStatus;
  fileSizeBytes?: number | null;
  errorMessage?: string | null;
  createdBy?: { fullName: string } | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface AskAiRequest {
  question: string;
}

export interface AskAiResponse {
  answer: string;
  grounded: boolean;
}

export interface PermissionCatalogItemDto {
  id: string;
  key: string;
  module: string;
  action: string;
  description?: string | null;
}

// -----------------------------------------------------------------------------
// PHASE 5 — FINANCE
// -----------------------------------------------------------------------------

export interface FinanceCategoryDto {
  id: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
}

export interface IncomeListItemDto {
  id: string;
  incomeNumber: string;
  date: string;
  category: { name: string };
  description?: string | null;
  amount: string;
  paymentMethod?: string | null;
  relatedMember?: { memberId: string; fullName: string } | null;
  createdBy?: { fullName: string } | null;
  approvedAt?: string | null;
}

export interface ExpenseListItemDto {
  id: string;
  expenseNumber: string;
  date: string;
  category: { name: string };
  description?: string | null;
  amount: string;
  paymentMethod?: string | null;
  paidTo?: string | null;
  createdBy?: { fullName: string } | null;
  approvedAt?: string | null;
}

export interface FinanceSummaryDto {
  totalIncome: string;
  totalExpense: string;
  currentBalance: string;
}

export interface CreateIncomeRequest {
  categoryId: string;
  date?: string;
  description?: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  relatedMemberId?: string;
  remarks?: string;
}

export interface CreateExpenseRequest {
  categoryId: string;
  date?: string;
  description?: string;
  amount: number;
  paymentMethod?: string;
  paidTo?: string;
  billNumber?: string;
  remarks?: string;
}

export interface DashboardSummaryDto {
  organizationName: string;
  greetingName: string;
  dateAD: string;
  dateBS: string;
  dayOfWeek: string;
  // Phase 1 shows structural placeholders for cards that depend on
  // modules not yet built (members, payments, finance). They report
  // zero/empty until those phases land, rather than fake numbers.
  totalMembers: number;
  activeMembers: number;
  lifetimeMembers: number;
  yearlyMembers: number;
  pendingApplications: number;
  expiringMemberships: number;
  todaysIncome: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  currentBalance: number;
  recentActivities: AuditLogDto[];
}

// -----------------------------------------------------------------------------
// DOCUMENT TEMPLATES (card/certificate theme designer)
// -----------------------------------------------------------------------------

export type TemplateElementKind = "text" | "image" | "shape" | "field";
export type TemplateFieldKey =
  | "memberName" | "memberId" | "membershipType" | "membershipDate"
  | "validUntil" | "cardNumber" | "certificateNumber" | "issueDate"
  | "photo" | "qr" | "orgName" | "orgLogo" | "bloodGroup" | "signature";

export interface TemplateElement {
  id: string;
  kind: TemplateElementKind;
  x: number; // percentage 0-100 of canvas width
  y: number; // percentage 0-100 of canvas height
  width: number; // percentage of canvas width
  height: number; // percentage of canvas height
  rotation: number; // degrees
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  // field (dynamic, resolved with real data at generation time)
  field?: TemplateFieldKey;
  label?: string; // shown in the designer only, e.g. "Member Name"
  // image
  imageData?: string; // base64 data URL
  // shape
  shapeType?: "rectangle" | "line" | "circle";
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export type DocumentTemplateKind = "CARD" | "CERTIFICATE";

export interface DocumentTemplateDto {
  id: string;
  type: DocumentTemplateKind;
  name: string;
  isDefault: boolean;
  backgroundColor: string;
  frontLayout: TemplateElement[];
  backLayout?: TemplateElement[] | null;
  referenceImageFront?: string | null;
  referenceImageBack?: string | null;
  customFontData?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDocumentTemplateRequest {
  type: DocumentTemplateKind;
  name: string;
  backgroundColor: string;
  frontLayout: TemplateElement[];
  backLayout?: TemplateElement[];
  referenceImageFront?: string;
  referenceImageBack?: string;
  customFontData?: string;
}
