import { StudioFlow } from "blockwright";

// The Studio pairing flow, drawn rather than described: generate a code, paste
// it into the plugin, then scripts land under the right services. Fully static —
// the three stages, the pairing code and the "Live" chip are all inside the
// component, and className is its only prop. On `/` it fills the right column
// of the Studio bridge section, so it is authored here at that column's width.
export const PairingFlow = () => <StudioFlow className="max-w-md" />;
