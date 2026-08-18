import type { Metadata, Viewport } from "next";
import { Archivo, Figtree, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Type.
 *
 * Archivo carries the display voice, run at its expanded width axis: wide,
 * flat-sided, heavy letterforms that echo the thing the product is named after.
 * It replaced Space Grotesk, which is the default display face of every AI
 * landing page, and Geist, which ships with create-next-app — neither was a
 * choice, and together they made the page look like software rather than like
 * Blockwright.
 *
 * Figtree sets the body: friendly and open enough for a fourteen-year-old
 * without tipping into a children's face.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Blockwright — Build Roblox experiences by describing them",
    template: "%s · Blockwright",
  },
  description:
    "Blockwright turns plain-language ideas into working Roblox systems: real Luau, real project files, applied straight into Roblox Studio.",
  openGraph: {
    type: "website",
    siteName: "Blockwright",
    title: "Blockwright — Build Roblox experiences by describing them",
    description:
      "Describe the mechanic. Blockwright writes the Luau, organises the project, and applies it in Roblox Studio.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#161514" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
