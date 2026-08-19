import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[30rem] w-full rounded-2xl" />}>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}
