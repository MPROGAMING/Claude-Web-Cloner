// Stand-in for next/navigation inside the design-system bundle. Only the hooks
// the synced components actually reach for. Navigation is inert by design: a
// preview card has nowhere to navigate to, and a card that threw on mount
// (which the real module does — no router context) shows nothing at all.
export function useRouter() {
  return {
    push() {},
    replace() {},
    back() {},
    forward() {},
    refresh() {},
    prefetch() {},
  };
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}
