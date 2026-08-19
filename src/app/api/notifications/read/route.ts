import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { getInbox, markAllRead, markRead } from "@/lib/notifications/service";

const bodySchema = z
  .object({
    ids: z.array(z.string().uuid()).max(100).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => value.all === true || (value.ids?.length ?? 0) > 0, {
    message: "Pass either ids or all.",
  });

/**
 * Mark notifications read.
 *
 * The account is never in the body — the update is filtered by `auth.uid()`'s
 * row set and by owner_id, so an id belonging to someone else matches nothing
 * rather than being rejected with a message that confirms it exists.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const body = bodySchema.parse(await request.json());

    if (body.all) {
      await markAllRead(supabase, user.id);
    } else {
      await markRead(supabase, user.id, body.ids ?? []);
    }

    // Return the fresh count rather than letting the client guess: a mark-read
    // racing an arriving notification would otherwise leave the badge wrong
    // until the next poll.
    const inbox = await getInbox(supabase, user.id);
    return NextResponse.json({ ok: true, unread: inbox.unread });
  } catch (error) {
    return errorResponse(error);
  }
}
