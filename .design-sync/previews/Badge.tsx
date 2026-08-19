import { Badge, StatusDot } from "blockwright";
import { Coins, FileCode2, Sparkles, TriangleAlert } from "lucide-react";

// Badge has no in-app caller yet, so these are the uses the vocabulary implies:
// project state, plan tier, model name, and a count. Variant semantics follow
// the button scale in docs/DESIGN_SYSTEM.md — `destructive` for a failure,
// `outline` for a neutral qualifier, `ghost` for the quietest label.
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Live</Badge>
    <Badge variant="secondary">Draft</Badge>
    <Badge variant="destructive">Validation failed</Badge>
    <Badge variant="outline">Archived</Badge>
    <Badge variant="ghost">Not synced</Badge>
    <Badge variant="link">View change set</Badge>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline">
      <Sparkles data-icon="inline-start" />
      Claude Sonnet 4.5
    </Badge>
    <Badge variant="secondary">
      <FileCode2 data-icon="inline-start" />
      9 scripts
    </Badge>
    <Badge variant="destructive">
      <TriangleAlert data-icon="inline-start" />
      2 Luau errors
    </Badge>
    <Badge>
      <Coins data-icon="inline-start" />
      2,000 credits
    </Badge>
  </div>
);

export const ProjectStates = () => (
  <div className="flex max-w-md flex-col gap-2">
    {[
      { name: "Bloxburg Tycoon", tone: "live" as const, state: "Live", variant: "default" as const },
      { name: "Obby Checkpoints", tone: "working" as const, state: "Applying", variant: "secondary" as const },
      { name: "Sword Fight Arena", tone: "idle" as const, state: "Draft", variant: "outline" as const },
      { name: "Lava Run", tone: "error" as const, state: "Validation failed", variant: "destructive" as const },
    ].map((project) => (
      <div
        key={project.name}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
      >
        <StatusDot tone={project.tone} />
        <span className="text-[0.8125rem] font-medium">{project.name}</span>
        <Badge variant={project.variant} className="ml-auto">
          {project.state}
        </Badge>
      </div>
    ))}
  </div>
);

export const PlanTiers = () => (
  <div className="flex max-w-sm flex-col gap-3">
    {[
      { plan: "Free", credits: "2,000", variant: "outline" as const },
      { plan: "Starter", credits: "25,000", variant: "secondary" as const },
      { plan: "Builder", credits: "60,000", variant: "default" as const },
    ].map((tier) => (
      <div key={tier.plan} className="flex items-center gap-2">
        <Badge variant={tier.variant}>{tier.plan}</Badge>
        <span className="text-[0.8125rem] tabular-nums text-muted-foreground">
          {tier.credits} credits
        </span>
      </div>
    ))}
  </div>
);

// Counts that change carry `tabular-nums` — docs/DESIGN_SYSTEM.md § Typography.
export const Counts = () => (
  <div className="flex max-w-sm flex-col gap-2.5 text-[0.8125rem]">
    <div className="flex items-center justify-between gap-3">
      <span>Unapplied changes</span>
      <Badge className="tabular-nums">3</Badge>
    </div>
    <div className="flex items-center justify-between gap-3">
      <span>ServerScriptService</span>
      <Badge variant="secondary" className="tabular-nums">
        6
      </Badge>
    </div>
    <div className="flex items-center justify-between gap-3">
      <span>ReplicatedStorage</span>
      <Badge variant="outline" className="tabular-nums">
        3
      </Badge>
    </div>
    <div className="flex items-center justify-between gap-3">
      <span>Failed validations</span>
      <Badge variant="destructive" className="tabular-nums">
        2
      </Badge>
    </div>
  </div>
);
