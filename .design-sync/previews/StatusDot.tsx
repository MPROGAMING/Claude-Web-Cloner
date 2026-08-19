import { StatusDot } from "blockwright";

// StatusDot is 8px and never appears alone in the product — docs/DESIGN_SYSTEM.md
// § Components › Status pairs it with the label it qualifies, which is also the
// only composition where the tone means anything.
const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-[0.8125rem] font-medium">{children}</div>
);

export const Tones = () => (
  <div className="flex flex-col gap-3">
    <Row>
      <StatusDot tone="live" />
      Studio connected
    </Row>
    <Row>
      <StatusDot tone="active" />
      Change set applied
    </Row>
    <Row>
      <StatusDot tone="working" />
      Writing Luau
    </Row>
    <Row>
      <StatusDot tone="idle" />
      Studio not connected
    </Row>
    <Row>
      <StatusDot tone="error" />
      Validation failed
    </Row>
  </div>
);

// `pulse` is reserved for genuinely live state.
export const Pulsing = () => (
  <div className="flex flex-col gap-3">
    <Row>
      <StatusDot tone="live" pulse />
      Live now
    </Row>
    <Row>
      <StatusDot tone="working" pulse />
      Applying to Studio
    </Row>
  </div>
);

export const InAStatusPanel = () => (
  <div className="rounded-lg border border-signal/35 bg-signal/6 p-3">
    <div className="flex items-center gap-2">
      <StatusDot tone="live" pulse />
      <p className="text-[0.8125rem] font-medium">Studio connected</p>
      <span className="ml-auto text-xs text-muted-foreground">Bloxburg Tycoon</span>
    </div>
  </div>
);
