import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A link that looks like a button.
 *
 * Deliberately *not* `<Button render={<Link/>}>` — Base UI's Button carries
 * native button semantics, and forcing an anchor through it breaks keyboard
 * and screen-reader behaviour (Enter vs Space, "link" vs "button" role).
 * Navigation gets an anchor; actions get a button.
 */
export function LinkButton({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="link-button"
      className={cn(buttonVariants({ variant, size }), "no-underline", className)}
      {...props}
    />
  );
}
