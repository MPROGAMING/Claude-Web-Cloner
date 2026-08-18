import { z } from "zod";

/**
 * The implementation plan, as a schema-constrained tool argument.
 *
 * Section 4 requires structured output rather than "return some JSON": a plan
 * parsed out of prose fails at the worst possible moment, halfway through a
 * build. Declaring it as a tool input means the provider constrains generation
 * to the schema and the SDK validates before we ever see it, so a malformed
 * plan is a tool error the model can retry — not a runtime crash.
 *
 * The fields are the ones that actually determine whether generated Roblox code
 * works: which services, which Instances, which remotes, and where the
 * client/server boundary falls. A plan that cannot answer those is not a plan.
 */

export const ROBLOX_SERVICE_NAMES = [
  "Workspace",
  "Players",
  "ReplicatedStorage",
  "ReplicatedFirst",
  "ServerScriptService",
  "ServerStorage",
  "StarterGui",
  "StarterPack",
  "StarterPlayer",
  "Lighting",
  "SoundService",
  "Teams",
  "TextChatService",
  "RunService",
  "TweenService",
  "UserInputService",
  "DataStoreService",
  "MemoryStoreService",
  "TeleportService",
  "PathfindingService",
  "CollectionService",
  "HttpService",
] as const;

export const planSchema = z.object({
  summary: z.string().max(300).describe("One or two sentences: what will exist when this is done."),

  assumptions: z
    .array(z.string().max(200))
    .max(6)
    .describe("Anything you had to decide because the request did not say. Be honest about these."),

  roblox_systems: z
    .array(z.string().max(80))
    .min(1)
    .max(10)
    .describe("The Roblox systems involved, e.g. 'round lifecycle', 'player teleportation'."),

  required_services: z
    .array(z.enum(ROBLOX_SERVICE_NAMES))
    .min(1)
    .max(12)
    .describe("Services that must be fetched with game:GetService()."),

  required_instances: z
    .array(
      z.object({
        class_name: z.string().max(60).describe("Exact Roblox ClassName, e.g. RemoteEvent, Folder."),
        name: z.string().max(60),
        parent: z.string().max(120).describe("Where it lives, e.g. ReplicatedStorage.Remotes."),
        purpose: z.string().max(160),
      }),
    )
    .max(20)
    .describe("Instances that must exist in the place for this to work."),

  scripts: z
    .array(
      z.object({
        path: z.string().max(240).describe("Project path, e.g. src/server/RoundService.server.luau"),
        kind: z.enum(["script", "localscript", "module", "config", "ui", "doc"]),
        context: z.enum(["server", "client", "shared"]),
        responsibility: z.string().max(200),
      }),
    )
    .min(1)
    .max(20)
    .describe("Every file this plan will create or change, including ModuleScripts."),

  remotes: z
    .array(
      z.object({
        name: z.string().max(60),
        kind: z.enum(["RemoteEvent", "RemoteFunction", "UnreliableRemoteEvent", "BindableEvent"]),
        direction: z.enum(["client_to_server", "server_to_client", "bidirectional", "server_internal"]),
        payload: z.string().max(200).describe("What is sent, and what the server must validate."),
      }),
    )
    .max(12)
    .describe("Client-server messages. State what the server validates for each."),

  client_server_boundary: z
    .string()
    .max(600)
    .describe(
      "What the server owns authoritatively and what the client only displays or requests. Be specific about state the client must never decide.",
    ),

  dependencies: z
    .array(z.string().max(160))
    .max(10)
    .describe("Ordering constraints between the steps below."),

  implementation_steps: z
    .array(
      z.object({
        index: z.number().int().min(1).max(30),
        action: z.string().max(200),
        touches: z.array(z.string().max(240)).max(8).describe("Paths this step writes."),
      }),
    )
    .min(1)
    .max(20),

  validation_steps: z
    .array(z.string().max(200))
    .min(1)
    .max(10)
    .describe("How correctness will be checked, e.g. 'validate_scripts passes with zero errors'."),

  expected_final_state: z
    .string()
    .max(600)
    .describe("Observable end state: what a player would see, and what exists in the place."),
});

export type ImplementationPlan = z.infer<typeof planSchema>;

export interface PlanReviewIssue {
  severity: "error" | "warning";
  rule: string;
  message: string;
}

/**
 * Application-boundary checks on a schema-valid plan.
 *
 * The schema guarantees shape, not sense. These catch plans that parse fine and
 * would still produce broken Roblox code — a client script claiming to own
 * authoritative state, a remote nobody reads, a step touching a file the plan
 * never declared.
 */
export function reviewPlan(plan: ImplementationPlan): PlanReviewIssue[] {
  const issues: PlanReviewIssue[] = [];
  const declared = new Set(plan.scripts.map((s) => s.path));

  for (const step of plan.implementation_steps) {
    for (const path of step.touches) {
      if (!declared.has(path)) {
        issues.push({
          severity: "warning",
          rule: "undeclared-file",
          message: `Step ${step.index} writes ${path}, which is not in the scripts list.`,
        });
      }
    }
  }

  for (const script of plan.scripts) {
    const path = script.path.toLowerCase();
    if (script.context === "server" && (path.startsWith("src/client") || path.startsWith("src/ui"))) {
      issues.push({
        severity: "error",
        rule: "context-path-mismatch",
        message: `${script.path} is declared server-side but lives in a client folder.`,
      });
    }
    if (script.context === "client" && path.startsWith("src/server")) {
      issues.push({
        severity: "error",
        rule: "context-path-mismatch",
        message: `${script.path} is declared client-side but lives in src/server.`,
      });
    }
    if (script.kind === "localscript" && script.context === "server") {
      issues.push({
        severity: "error",
        rule: "localscript-on-server",
        message: `${script.path} is a LocalScript declared to run on the server; it would never run.`,
      });
    }
  }

  // A remote with no server-side file is a boundary that nothing enforces.
  const hasServerFile = plan.scripts.some((s) => s.context === "server");
  if (plan.remotes.some((r) => r.direction === "client_to_server") && !hasServerFile) {
    issues.push({
      severity: "error",
      rule: "unhandled-remote",
      message: "The plan sends client-to-server messages but declares no server script to receive them.",
    });
  }

  if (plan.remotes.length && !/valid|check|verify|sanitis|sanitiz|authorit/i.test(plan.client_server_boundary)) {
    issues.push({
      severity: "warning",
      rule: "boundary-unspecified",
      message: "The client/server boundary does not say what the server validates.",
    });
  }

  return issues;
}

/** Compact rendering shown to the user as a checklist. */
export function planToSteps(plan: ImplementationPlan): string[] {
  return plan.implementation_steps
    .sort((a, b) => a.index - b.index)
    .map((step) => step.action);
}
