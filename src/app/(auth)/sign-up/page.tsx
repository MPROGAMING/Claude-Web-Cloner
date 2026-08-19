import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[34rem] w-full rounded-2xl" />}>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
