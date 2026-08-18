import { NextResponse } from "next/server";
import {
  dispatchCommands,
  heartbeat,
  recordCommandResults,
  resolveToken,
} from "@/lib/studio/service";
import { studioPollSchema } from "@/lib/studio/protocol";
import { errorResponse } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * The plugin's single endpoint once paired. Each call does three things:
 *   1. reports results from the previous batch
 *   2. records a heartbeat (this is what makes the app show "connected")
 *   3. returns the next queued commands
 *
 * Keeping it to one endpoint means the plugin loop is ~20 lines of Luau.
 */
export async function POST(request: Request) {
  try {
    const body = studioPollSchema.parse(await request.json());

    const connection = await resolveToken(body.token);

    const limit = rateLimit(`studio-poll:${connection.id}`, { limit: 90, windowMs: 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Polling too fast." } },
        { status: 429 },
      );
    }

    if (body.results?.length) {
      await recordCommandResults(connection, body.results);
      logger.info("studio.results", {
        projectId: connection.project_id,
        count: body.results.length,
      });
    }

    await heartbeat(connection.id, {
      placeName: body.placeName,
      placeId: body.placeId != null ? String(body.placeId) : undefined,
    });

    const commands = await dispatchCommands(connection);

    return NextResponse.json({ commands, pollIntervalSeconds: commands.length ? 1 : 3 });
  } catch (error) {
    return errorResponse(error);
  }
}
