"use client";
import { useParams } from "next/navigation";
import { VerifyResult } from "../../../../components/verify-result";

export default function VerifyMemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  return <VerifyResult endpoint={`/verify/member/${memberId}`} title="Member Verification" />;
}
