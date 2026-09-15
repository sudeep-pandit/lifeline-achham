"use client";

import { useSearchParams } from "next/navigation";
import { Card } from "../../../components/ui/card";

export function PaymentResultContent() {
  const params = useSearchParams();
  const status = params.get("status");

  return (
    <Card className="w-full max-w-md text-center">
      {status === "success" ? (
        <>
          <p className="font-display text-2xl text-navy dark:text-paper">Payment received</p>
          <p className="mt-2 text-sm text-navy-400 dark:text-navy-100">
            We're confirming this with the payment provider now. Once confirmed, your application
            moves to review automatically — you don't need to do anything else.
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-2xl text-navy dark:text-paper">Payment not completed</p>
          <p className="mt-2 text-sm text-navy-400 dark:text-navy-100">
            Your payment wasn't completed. You can return to your application and try again, or pay
            in person / by bank deposit and reference your application number.
          </p>
        </>
      )}
    </Card>
  );
}
