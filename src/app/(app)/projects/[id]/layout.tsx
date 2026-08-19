/**
 * The workspace owns the full viewport rather than the standard app shell's
 * scrolling body, so it renders straight into the shell's `<main>`.
 *
 * The shell reserves 56px at the bottom for the mobile tab bar (`pb-14`) and
 * that padding is left in place here — the workspace sizes itself to what is
 * left, which is why the composer is the last thing on screen and not the last
 * thing *under* the tab bar.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
