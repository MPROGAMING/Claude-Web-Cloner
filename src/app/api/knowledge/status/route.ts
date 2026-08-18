import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import {
  describeBrainConfiguration,
  getBrainModelDefinition,
  type BrainStatus,
} from "@/lib/knowledge/generation-config";
import { logger } from "@/lib/logger";

/**
 * Roblox Brain readiness.
 *
 * Reports what is *actually* configured, verified against the database rather
 * than inferred from env vars alone. A missing key degrades one subsystem and
 * is reported honestly; it never crashes the app, and the UI must not present a
 * model as available until this says so.
 *
 * Returns no secrets — only whether each subsystem is ready and, where not,
 * the name of the variable to set.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const config = describeBrainConfiguration();
    const details = [...config.details];

    // The model must be in the registry; a slug that is not registered would
    // otherwise fail only at generation time.
    const definition = getBrainModelDefinition();
    const modelRegistered = Boolean(definition);

    // Knowledge database readiness is a real query, not an assumption.
    let knowledgeDatabase: BrainStatus["knowledgeDatabase"] = "not-configured";
    let documentCount = 0;
    let chunkCount = 0;
    let embeddingCount = 0;

    try {
      const admin = createAdminClient();
      const [docs, chunks, embeds] = await Promise.all([
        admin.from("knowledge_documents").select("*", { count: "exact", head: true }),
        admin.from("knowledge_chunks").select("*", { count: "exact", head: true }),
        admin.from("knowledge_embeddings").select("*", { count: "exact", head: true }),
      ]);
      documentCount = docs.count ?? 0;
      chunkCount = chunks.count ?? 0;
      embeddingCount = embeds.count ?? 0;
      knowledgeDatabase = documentCount > 0 ? "ready" : "not-configured";
      if (documentCount === 0) {
        details.push("Knowledge base is empty. Run: npm run brain:ingest");
      }
    } catch (error) {
      knowledgeDatabase = "error";
      details.push("Knowledge database is unreachable.");
      logger.warn("brain.status.db_unreachable", { error: String(error) });
    }

    const generationReady = config.generationProvider === "ready" && modelRegistered;
    if (config.generationProvider === "ready" && !modelRegistered) {
      details.push(
        `Model "${config.generationModel}" is not registered. Generation will fail until it is added to the registry.`,
      );
    }

    const status: BrainStatus & {
      modelRegistered: boolean;
      counts: { documents: number; chunks: number; embeddings: number };
    } = {
      brain: knowledgeDatabase === "ready" && generationReady ? "ready" : "not-configured",
      generationProvider: generationReady ? "ready" : "not-configured",
      generationProviderName: "OpenRouter",
      generationModel: config.generationModel,
      knowledgeDatabase,
      embeddingProvider: config.embeddingProvider,
      embeddingModel: config.embeddingModel,
      modelRegistered,
      counts: { documents: documentCount, chunks: chunkCount, embeddings: embeddingCount },
      details,
    };

    return NextResponse.json(status);
  } catch (error) {
    return errorResponse(error);
  }
}
