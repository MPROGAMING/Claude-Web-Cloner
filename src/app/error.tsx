"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Logo } from "@/components/brand/logo";

/**
 * Root error boundary. Users see a plain message; the digest is the only
 * identifier shown, so a stack trace never reaches the browser.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app.render_error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        That page failed to load. Trying again usually clears it — nothing in your project was
        lost.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[0.625rem] text-muted-foreground/60">
          reference {error.digest}
        </p>
      )}
      <div className="mt-7 flex justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" />
          Try again
        </Button>
        <LinkButton href="/dashboard" variant="outline">
          Back to projects
        </LinkButton>
      </div>
    </main>
  );
}
