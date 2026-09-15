"use client";
import { useParams } from "next/navigation";
import { VerifyResult } from "../../../../components/verify-result";

export default function VerifyCertificatePage() {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  return <VerifyResult endpoint={`/verify/certificate/${certificateNumber}`} title="Certificate Verification" />;
}
