import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-blueprint opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18rem] size-[32rem] -translate-x-1/2 rounded-full bg-[var(--ember)]/10 blur-[110px]"
      />

      <header className="relative flex h-16 items-center px-5 sm:px-8">
        <Link href="/" className="rounded-md focus-ember" aria-label="Blockwright home">
          <Logo />
        </Link>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:items-center sm:py-12">
        {children}
      </main>
    </div>
  );
}
