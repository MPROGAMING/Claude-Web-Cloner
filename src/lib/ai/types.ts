import type { UIMessage } from "ai";

/**
 * Typed UI messages.
 *
 * `data-status` is a transient part streamed while the agent works — it powers
 * the live status rail and is deliberately *not* persisted into message history.
 * `data-artifact` is persisted so a reloaded conversation still shows which
 * files a turn touched.
 */

export interface StatusData {
  id: string;
  label: string;
  state: "running" | "done" | "failed";
  detail?: string;
}

export interface ArtifactData {
  path: string;
  kind: string;
  change: "created" | "updated" | "deleted";
  bytes?: number;
}

export interface PlanData {
  goal: string;
  steps: string[];
}

/** Roblox Brain sources that backed an answer. Persisted with the message. */
export interface CitationData {
  citations: {
    label: string;
    title: string;
    url: string | null;
    repository: string;
    authority: string;
    license: string;
    deprecated: boolean;
  }[];
}

/**
 * A proposed change set awaiting approval.
 *
 * Persisted with the message so a conversation reloaded tomorrow still offers
 * the same approval decision — and so approval is always tied to a specific,
 * recorded set of operations rather than to the conversation's mood.
 */
export interface ChangesetData {
  changesetId: string;
  status: string;
  summary: string;
  operations: {
    kind: "create" | "update" | "delete" | "move" | "rename";
    path: string;
    toPath?: string;
    summary: string;
    bytes?: number;
    validation?: { errors: number; warnings: number };
  }[];
  issues: { severity: "error" | "warning"; rule: string; message: string; path?: string }[];
  totals: Record<string, number>;
}

export type BlockwrightUIMessage = UIMessage<
  { modelId?: string; createdAt?: string; credits?: number },
  {
    status: StatusData;
    artifact: ArtifactData;
    plan: PlanData;
    citations: CitationData;
    changeset: ChangesetData;
  }
>;
