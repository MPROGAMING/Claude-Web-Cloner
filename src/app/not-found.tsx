import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-blueprint opacity-40 [mask-image:radial-gradient(ellipse_50%_45%_at_50%_50%,black,transparent)]"
      />
      <div className="relative">
        <Link href="/" className="inline-flex rounded-md focus-ember">
          <Logo />
        </Link>
        <p className="mt-10 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold">This page does not exist</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The link may be out of date, or the project may have been deleted.
        </p>
        <div className="mt-7 flex justify-center gap-2">
          <LinkButton href="/dashboard">Go to your projects</LinkButton>
          <LinkButton href="/" variant="outline">
            Home
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
