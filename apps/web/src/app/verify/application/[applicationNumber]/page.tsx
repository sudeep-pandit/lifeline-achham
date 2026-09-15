"use client";
import { useParams } from "next/navigation";
import { VerifyResult } from "../../../../components/verify-result";

export default function VerifyApplicationPage() {
  const { applicationNumber } = useParams<{ applicationNumber: string }>();
  return <VerifyResult endpoint={`/verify/application/${applicationNumber}`} title="Temporary Registration Verification" />;
}
