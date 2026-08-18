import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { Database, StudioCommand, StudioConnection } from "@/lib/supabase/types";
import {
  CONNECTION_STALE_MS,
  PAIR_CODE_TTL_MS,
  type DispatchedCommand,
  type StudioActionName,
} from "@/lib/studio/protocol";
import { KIND_TO_CLASS, inferService, instanceNameFor } from "@/lib/roblox/project-model";

/**
 * Studio bridge.
 *
 * The plugin cannot accept inbound connections, so the flow is: the user
 * generates a short pairing code in the app, types it into the plugin, and the
 * plugin exchanges it for a long-lived token. It then polls for queued commands
 * and posts results back. No websockets, no tunnels, nothing to keep alive.
 *
 * Two families of function live here, and the split matters:
 *
 *   - **Session functions** take the caller's own client. RLS applies, so a
 *     user can only ever touch their own connection. These are what the web app
 *     calls, and they work with no service-role key configured.
 *
 *   - **Plugin functions** use the service-role client, because a polling
 *     plugin has no session — it authenticates with a hashed token, and this
 *     module does the authorization itself.
 */

type Client = SupabaseClient<Database>;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Unambiguous alphabet: no 0/O/1/I. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePairCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export async function getConnection(
  supabase: Client,
  projectId: string,
  userId: string,
): Promise<StudioConnection | null> {
  const { data } = await supabase
    .from("studio_connections")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!data) return null;

  // A connection that stopped polling is reported as disconnected without
  // needing a background job.
  if (data.status === "connected" && data.last_seen_at) {
    const age = Date.now() - new Date(data.last_seen_at).getTime();
    if (age > CONNECTION_STALE_MS) {
      return { ...data, status: "disconnected" };
    }
  }
  return data;
}

/** Creates (or refreshes) a pairing code for a project. */
export async function createPairingCode(
  supabase: Client,
  projectId: string,
  userId: string,
) {
  const code = generatePairCode();
  const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("studio_connections")
    .upsert(
      {
        project_id: projectId,
        owner_id: userId,
        pair_code: code,
        pair_expires_at: expiresAt,
        token_hash: null,
        status: "pending",
        last_seen_at: null,
      },
      { onConflict: "project_id" },
    )
    .select()
    .single();

  if (error) throw new AppError("database_error", "Could not start Studio pairing.", 500);
  return { connection: data, code, expiresAt };
}

export async function disconnectStudio(
  supabase: Client,
  projectId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("studio_connections")
    .update({ status: "disconnected", token_hash: null, pair_code: null })
    .eq("project_id", projectId)
    .eq("owner_id", userId);

  if (error) throw new AppError("database_error", "Could not disconnect Studio.", 500);
}

/** Plugin side: exchange a pairing code for a token. */
export async function claimPairingCode(params: {
  code: string;
  placeName?: string;
  placeId?: string;
  studioVersion?: string;
}) {
  const supabase = createAdminClient();
  const code = params.code.trim().toUpperCase();

  const { data: connection } = await supabase
    .from("studio_connections")
    .select("*")
    .eq("pair_code", code)
    .maybeSingle();

  if (!connection) {
    throw new AppError("not_found", "That pairing code is not valid.", 404);
  }
  if (connection.pair_expires_at && new Date(connection.pair_expires_at) < new Date()) {
    throw new AppError("invalid_request", "That pairing code has expired. Generate a new one.", 410);
  }

  const token = randomBytes(32).toString("base64url");

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", connection.project_id)
    .maybeSingle();

  const { error } = await supabase
    .from("studio_connections")
    .update({
      token_hash: hashToken(token),
      pair_code: null,
      pair_expires_at: null,
      status: "connected",
      place_name: params.placeName ?? null,
      place_id: params.placeId ?? null,
      studio_version: params.studioVersion ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (error) throw new AppError("database_error", "Could not complete pairing.", 500);

  await supabase.from("activity_events").insert({
    owner_id: connection.owner_id,
    project_id: connection.project_id,
    kind: "studio.connected",
    summary: `Roblox Studio connected${params.placeName ? ` (${params.placeName})` : ""}`,
    detail: { placeName: params.placeName ?? null },
  });

  return {
    token,
    projectId: connection.project_id,
    projectName: project?.name ?? "Project",
  };
}

/** Plugin side: resolve a bearer token to its connection. */
export async function resolveToken(token: string): Promise<StudioConnection> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("studio_connections")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data || data.status === "disconnected") {
    throw new AppError("unauthorized", "This Studio session is no longer valid. Re-pair the plugin.", 401);
  }
  return data;
}

export async function enqueueStudioCommand(
  supabase: Client,
  params: {
    projectId: string;
    userId: string;
    connectionId: string | null;
    action: StudioActionName;
    payload: Record<string, unknown>;
  },
): Promise<StudioCommand> {
  const { data, error } = await supabase
    .from("studio_commands")
    .insert({
      project_id: params.projectId,
      owner_id: params.userId,
      connection_id: params.connectionId,
      action: params.action,
      payload: params.payload as never,
    })
    .select()
    .single();

  if (error) throw new AppError("database_error", "Could not queue the Studio action.", 500);
  return data;
}

/**
 * Drain the queue for a connection and mark the batch dispatched.
 * `sync_files` is resolved here into concrete file payloads so the plugin never
 * needs database access or a second round trip.
 */
export async function dispatchCommands(
  connection: StudioConnection,
  limit = 5,
): Promise<DispatchedCommand[]> {
  const supabase = createAdminClient();

  const { data: queued } = await supabase
    .from("studio_commands")
    .select("*")
    .eq("project_id", connection.project_id)
    .eq("status", "queued")
    .order("created_at")
    .limit(limit);

  if (!queued?.length) return [];

  await supabase
    .from("studio_commands")
    .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
    .in(
      "id",
      queued.map((c) => c.id),
    );

  const dispatched: DispatchedCommand[] = [];

  for (const command of queued) {
    const payload = (command.payload ?? {}) as Record<string, unknown>;
    const base: DispatchedCommand = {
      id: command.id,
      action: command.action as StudioActionName,
      payload,
    };

    if (command.action === "sync_files") {
      let query = supabase
        .from("project_files")
        .select("path, content, kind")
        .eq("project_id", connection.project_id);

      const paths = payload.paths;
      if (Array.isArray(paths) && paths.length) {
        query = query.in("path", paths as string[]);
      }

      const { data: files } = await query;
      base.files = (files ?? [])
        .filter((f) => /\.luau?$/i.test(f.path))
        .map((f) => ({
          path: f.path,
          name: instanceNameFor(f.path),
          className: KIND_TO_CLASS[f.kind],
          service: inferService(f.path),
          source: f.content,
        }));
    }

    dispatched.push(base);
  }

  return dispatched;
}

export async function recordCommandResults(
  connection: StudioConnection,
  results: {
    commandId: string;
    ok: boolean;
    summary?: string;
    error?: string;
    data?: Record<string, unknown>;
  }[],
) {
  if (!results.length) return;
  const supabase = createAdminClient();

  for (const result of results) {
    // Scoped by project_id so a token can only close its own project's commands.
    await supabase
      .from("studio_commands")
      .update({
        status: result.ok ? "succeeded" : "failed",
        result: (result.data ?? {}) as never,
        error_message: result.error ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", result.commandId)
      .eq("project_id", connection.project_id);

    await supabase.from("activity_events").insert({
      owner_id: connection.owner_id,
      project_id: connection.project_id,
      kind: result.ok ? "studio.succeeded" : "studio.failed",
      summary: result.summary ?? (result.ok ? "Studio action completed" : "Studio action failed"),
      detail: { error: result.error ?? null, ...(result.data ?? {}) },
    });
  }
}

export async function heartbeat(
  connectionId: string,
  info: { placeName?: string; placeId?: string },
) {
  const supabase = createAdminClient();
  await supabase
    .from("studio_connections")
    .update({
      last_seen_at: new Date().toISOString(),
      status: "connected",
      ...(info.placeName ? { place_name: info.placeName } : {}),
      ...(info.placeId ? { place_id: info.placeId } : {}),
    })
    .eq("id", connectionId);
}

/** Recent commands for the project panel. */
export async function listRecentCommands(
  supabase: Client,
  projectId: string,
  userId: string,
  limit = 12,
) {
  const { data } = await supabase
    .from("studio_commands")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
