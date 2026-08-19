import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  StatusDot,
  Badge,
} from "blockwright";
import { ChevronDown, FileCode2 } from "lucide-react";

// docs/DESIGN_SYSTEM.md § Messages: a tool call is a single-line row, expandable,
// and the default view is "what happened" with the JSON one click away.
const Row = ({ children }: { children: React.ReactNode }) => (
  <span className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem]">
    {children}
  </span>
);

export const ToolCallExpanded = () => (
  <Collapsible defaultOpen className="max-w-md rounded-lg border border-border bg-surface p-1">
    <CollapsibleTrigger
      render={
        <button type="button" className="w-full focus-ember">
          <Row>
            <StatusDot tone="active" />
            <FileCode2 className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">write_file</span>
            <span className="truncate text-muted-foreground">RoundTimer.server.luau</span>
            <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
          </Row>
        </button>
      }
    />
    <CollapsibleContent>
      <pre className="code-type overflow-hidden rounded-md bg-surface-sunken p-2.5 text-muted-foreground">
{`{
  "path": "ServerScriptService/RoundTimer.server.luau",
  "lines": 84,
  "validated": true
}`}
      </pre>
    </CollapsibleContent>
  </Collapsible>
);

export const Collapsed = () => (
  <Collapsible className="max-w-md rounded-lg border border-border bg-surface p-1">
    <CollapsibleTrigger
      render={
        <button type="button" className="w-full focus-ember">
          <Row>
            <StatusDot tone="active" />
            <FileCode2 className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">read_file</span>
            <span className="truncate text-muted-foreground">Remotes.luau</span>
            <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
          </Row>
        </button>
      }
    />
    <CollapsibleContent>
      <pre className="code-type rounded-md bg-surface-sunken p-2.5">read 41 lines</pre>
    </CollapsibleContent>
  </Collapsible>
);

export const AStackOfCalls = () => (
  <div className="flex max-w-md flex-col gap-1 rounded-lg border border-border bg-surface p-1">
    {[
      { verb: "plan_mechanic", target: "round-based tycoon", tone: "active" as const, open: false },
      { verb: "write_file", target: "ShopService.server.luau", tone: "active" as const, open: true },
      { verb: "validate_luau", target: "9 scripts", tone: "working" as const, open: false },
    ].map((c) => (
      <Collapsible key={c.verb} defaultOpen={c.open}>
        <CollapsibleTrigger
          render={
            <button type="button" className="w-full focus-ember">
              <Row>
                <StatusDot tone={c.tone} />
                <span className="font-mono text-xs">{c.verb}</span>
                <span className="truncate text-muted-foreground">{c.target}</span>
                <Badge variant="outline" className="ml-auto">
                  {c.open ? "open" : "1 result"}
                </Badge>
              </Row>
            </button>
          }
        />
        <CollapsibleContent>
          <pre className="code-type rounded-md bg-surface-sunken p-2.5 text-muted-foreground">
            84 lines written, no Luau errors
          </pre>
        </CollapsibleContent>
      </Collapsible>
    ))}
  </div>
);
