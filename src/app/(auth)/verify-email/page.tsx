import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full max-w-sm rounded-xl" />}>
      <VerifyEmailPanel />
    </Suspense>
  );
}
