import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type {
  ActivityEvent,
  Conversation,
  CreditBalance,
  CreditTransaction,
  MessageRow,
  Profile,
  Project,
  ProjectFile,
} from "@/lib/supabase/types";

/**
 * Read helpers for Server Components.
 *
 * Every one of these uses the *request-scoped* client, so RLS applies and a
 * user physically cannot read another user's rows even if a query forgot a
 * filter. The explicit owner_id filters are belt-and-braces.
 */

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);
  return { supabase, user };
}

export async function getProfile(): Promise<Profile | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export async function getCreditBalance(): Promise<CreditBalance | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("credit_balances")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}

export async function listProjects(options?: {
  status?: "active" | "archived";
  limit?: number;
}): Promise<Project[]> {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) query = query.limit(options.limit);

  const { data } = await query;
  return data ?? [];
}

export async function getProject(projectId: string): Promise<Project | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  return data;
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("path");
  return data ?? [];
}

export async function listConversations(projectId: string): Promise<Conversation[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function getConversationMessages(conversationId: string): Promise<MessageRow[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("seq")
    .limit(300);
  return data ?? [];
}

export async function listActivity(options?: {
  projectId?: string;
  limit?: number;
}): Promise<ActivityEvent[]> {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("activity_events")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 40);

  if (options?.projectId) query = query.eq("project_id", options.projectId);

  const { data } = await query;
  return data ?? [];
}

export async function listCreditTransactions(limit = 60): Promise<CreditTransaction[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getUsageSummary() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("ai_requests")
    .select(
      "id, model_id, provider, credits_charged, input_tokens, output_tokens, created_at, status, latency_ms",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const requests = data ?? [];
  const byModel = new Map<string, { credits: number; requests: number }>();

  for (const request of requests) {
    const entry = byModel.get(request.model_id) ?? { credits: 0, requests: 0 };
    entry.credits += request.credits_charged;
    entry.requests += 1;
    byModel.set(request.model_id, entry);
  }

  return {
    requests,
    totalCredits: requests.reduce((sum, r) => sum + r.credits_charged, 0),
    totalRequests: requests.length,
    byModel: [...byModel.entries()]
      .map(([modelId, stats]) => ({ modelId, ...stats }))
      .sort((a, b) => b.credits - a.credits),
  };
}
