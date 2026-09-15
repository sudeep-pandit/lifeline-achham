import { clsx } from "clsx";

const TONES = {
  active: "bg-sage-50 text-sage border border-sage/30",
  neutral: "bg-navy-50 text-navy-400 border border-navy-100 dark:bg-navy-600 dark:text-navy-100 dark:border-navy-400",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-crimson-50 text-crimson-600 border border-crimson/20",
} as const;

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  ACTIVE: "active",
  APPROVED: "active",
  PAID: "active",
  MANUALLY_VERIFIED: "active",
  EXPIRING_SOON: "warning",
  UNDER_REVIEW: "warning",
  SUBMITTED: "warning",
  PAYMENT_PENDING: "warning",
  PENDING: "warning",
  PROCESSING: "warning",
  EXPIRED: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  PAYMENT_FAILED: "danger",
  FAILED: "danger",
  REFUNDED: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span className={clsx("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", TONES[tone])}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
