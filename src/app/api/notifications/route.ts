import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { getInbox } from "@/lib/notifications/service";

/**
 * Polled by the bell so a build that finishes while the creator is on another
 * page still reaches them. Two indexed reads scoped to one account, and the
 * caller stops polling when the tab is hidden.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const inbox = await getInbox(supabase, user.id);

    return NextResponse.json(
      {
        unread: inbox.unread,
        notifications: inbox.items.map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          body: row.body,
          href: row.href,
          // Carried so the bell can tell whether the page the user was already
          // looking at has announced this run itself.
          projectId: row.project_id,
          readAt: row.read_at,
          createdAt: row.created_at,
        })),
      },
      // A polled endpoint that any layer is free to cache is a badge that
      // stops updating.
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
