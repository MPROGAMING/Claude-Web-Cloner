import { NextResponse } from "next/server";
import { claimPairingCode } from "@/lib/studio/service";
import { studioPairSchema } from "@/lib/studio/protocol";
import { errorResponse } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Called by the Roblox Studio plugin with the 6-character code the user copied
 * from the app. Exchanges it for a long-lived plugin token.
 *
 * This route is unauthenticated by design — the pairing code *is* the
 * credential. It is short, single-use, expires in 10 minutes, and is rate
 * limited hard so it cannot be brute forced.
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(`studio-pair:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many pairing attempts. Wait a minute." } },
        { status: 429 },
      );
    }

    const body = studioPairSchema.parse(await request.json());
    const result = await claimPairingCode({
      code: body.code,
      placeName: body.placeName,
      placeId: body.placeId != null ? String(body.placeId) : undefined,
      studioVersion: body.studioVersion,
    });

    logger.info("studio.paired", { projectId: result.projectId });

    return NextResponse.json({
      token: result.token,
      projectId: result.projectId,
      projectName: result.projectName,
    });
  } catch (error) {
    logger.warn("studio.pair_failed", { error: String(error) });
    return errorResponse(error);
  }
}

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
