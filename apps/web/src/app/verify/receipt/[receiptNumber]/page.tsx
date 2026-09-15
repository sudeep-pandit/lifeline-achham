"use client";
import { useParams } from "next/navigation";
import { VerifyResult } from "../../../../components/verify-result";

export default function VerifyReceiptPage() {
  const { receiptNumber } = useParams<{ receiptNumber: string }>();
  return <VerifyResult endpoint={`/verify/receipt/${receiptNumber}`} title="Receipt Verification" />;
}
