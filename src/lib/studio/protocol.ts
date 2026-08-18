import { z } from "zod";

/**
 * The wire contract between the web app and the Roblox Studio plugin.
 *
 * Kept deliberately small. The plugin is the only thing that can touch Instances,
 * so the protocol describes *intent* ("sync these files", "run a play test"),
 * never raw Studio API calls — a command is an allowlisted verb, not a script
 * the server hands the plugin to run.
 */

export const STUDIO_ACTIONS = [
  "sync_files",
  "inspect_place",
  "create_folder",
  "remove_instance",
  "run_test",
] as const;

export type StudioActionName = (typeof STUDIO_ACTIONS)[number];

export const studioActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sync_files"),
    paths: z
      .array(z.string().max(240))
      .max(80)
      .optional()
      .describe("Files to push. Omit to sync the whole project."),
    note: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("inspect_place"),
    note: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("create_folder"),
    service: z.string().max(60),
    name: z.string().max(60),
    note: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("run_test"),
    note: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("remove_instance"),
    service: z.string().max(60),
    path: z.string().max(200).describe("Dot path under the service, e.g. Modules.OldShop"),
    note: z.string().max(200).optional(),
  }),
]);

export type StudioAction = z.infer<typeof studioActionSchema>;

/** What the plugin sends back for each command. */
export const studioResultSchema = z.object({
  commandId: z.string().uuid(),
  ok: z.boolean(),
  summary: z.string().max(500).optional(),
  error: z.string().max(1000).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type StudioResult = z.infer<typeof studioResultSchema>;

/** Handshake payload the plugin sends when exchanging a pairing code. */
export const studioPairSchema = z.object({
  code: z.string().min(4).max(16),
  placeName: z.string().max(120).optional(),
  placeId: z.union([z.string(), z.number()]).optional(),
  studioVersion: z.string().max(60).optional(),
});

/** Poll request: the plugin asks for queued work and reports it is alive. */
export const studioPollSchema = z.object({
  token: z.string().min(16).max(200),
  placeName: z.string().max(120).optional(),
  placeId: z.union([z.string(), z.number()]).optional(),
  results: z.array(studioResultSchema).max(20).optional(),
});

/** A command as delivered to the plugin. */
export interface DispatchedCommand {
  id: string;
  action: StudioActionName;
  payload: Record<string, unknown>;
  /** Present for sync_files — resolved server-side so the plugin stays dumb. */
  files?: {
    path: string;
    name: string;
    className: string;
    service: string;
    source: string;
  }[];
}

export const PAIR_CODE_TTL_MS = 10 * 60 * 1000;
export const CONNECTION_STALE_MS = 25_000;
export const COMMAND_EXPIRY_MS = 5 * 60 * 1000;
