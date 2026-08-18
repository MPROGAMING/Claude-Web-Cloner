/**
 * The workspace owns the full viewport, so it opts out of the standard app
 * shell padding that the mobile nav reserves.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <div className="-mb-14 md:mb-0">{children}</div>;
}
