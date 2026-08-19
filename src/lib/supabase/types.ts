/**
 * Hand-maintained database types mirroring supabase/migrations/0001_init.sql.
 *
 * Kept by hand (rather than generated) so the repo stays runnable without the
 * Supabase CLI. If you change the SQL, change this file in the same commit.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type ProjectStatus = "active" | "archived";
export type FileKind = "script" | "localscript" | "module" | "config" | "doc" | "ui";
export type StudioStatus = "pending" | "connected" | "disconnected" | "expired";
export type CommandStatus = "queued" | "dispatched" | "succeeded" | "failed" | "expired";
export type RequestStatus = "running" | "succeeded" | "failed" | "aborted";
export type TransactionKind =
  | "grant"
  | "signup_bonus"
  | "purchase"
  | "usage"
  | "refund"
  | "adjustment";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  roblox_username: string | null;
  default_model_id: string;
  plan: "free" | "creator" | "studio";
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditBalance = {
  user_id: string;
  balance: number;
  lifetime_granted: number;
  lifetime_spent: number;
  updated_at: string;
};

export type CreditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  kind: TransactionKind;
  description: string | null;
  balance_after: number;
  reference_id: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  model_id: string;
  template_slug: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
};

export type ProjectFile = {
  id: string;
  project_id: string;
  owner_id: string;
  path: string;
  content: string;
  kind: FileKind;
  roblox_parent: string | null;
  size_bytes: number;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type FileRevision = {
  id: string;
  file_id: string;
  project_id: string;
  owner_id: string;
  revision: number;
  content: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  project_id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  owner_id: string;
  role: "user" | "assistant" | "system";
  parts: Json;
  model_id: string | null;
  seq: number;
  created_at: string;
};

export type AiRequest = {
  id: string;
  owner_id: string;
  project_id: string | null;
  conversation_id: string | null;
  provider: string;
  model_id: string;
  status: RequestStatus;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_input_tokens: number;
  credits_charged: number;
  latency_ms: number | null;
  tool_calls: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ActivityEvent = {
  id: string;
  owner_id: string;
  project_id: string | null;
  kind: string;
  summary: string;
  detail: Json;
  created_at: string;
};

export type StudioConnection = {
  id: string;
  project_id: string;
  owner_id: string;
  pair_code: string | null;
  pair_expires_at: string | null;
  token_hash: string | null;
  status: StudioStatus;
  place_name: string | null;
  place_id: string | null;
  studio_version: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type StudioCommand = {
  id: string;
  project_id: string;
  owner_id: string;
  connection_id: string | null;
  action: string;
  payload: Json;
  status: CommandStatus;
  result: Json;
  error_message: string | null;
  created_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
};

// ---------------------------------------------------------------------------
// Roblox Brain knowledge tables. Global reference data: readable by any signed
// in user, writable only by the ingestion pipeline via the service role.
// Row shapes are type aliases, not interfaces - see the note at the top of this
// file about postgrest-js's Record<string, unknown> constraint.
// ---------------------------------------------------------------------------

export type KnowledgeSource = {
  id: string;
  remote: string;
  branch: string;
  commit: string;
  commit_date: string;
  license: string;
  attribution_required: boolean;
  retrieved_at: string;
  document_count: number;
  created_at: string;
  updated_at: string;
};

export type KnowledgeDocument = {
  source_id: string;
  source_repository: string;
  source_commit: string;
  source_path: string;
  source_url: string | null;
  source_type: string;
  authority: "canonical" | "secondary" | "historical";
  license: string;
  retrieved_at: string;
  content_date: string;
  category: string;
  topic: string;
  semantic_topic: string | null;
  deprecated: boolean;
  title: string | null;
  heading_path: string[] | null;
  structured: boolean;
  payload: Json;
  content_hash: string;
  chunk_total: number;
  created_at: string;
};

export type KnowledgeChunk = {
  id: string;
  source_id: string;
  chunk_index: number;
  chunk_total: number;
  source_repository: string;
  source_type: string;
  authority: string;
  category: string;
  semantic_topic: string | null;
  deprecated: boolean;
  title: string | null;
  heading_path: string[] | null;
  heading_text: string;
  api_symbols: string[];
  symbols_text: string;
  content: string;
  token_estimate: number;
  created_at: string;
};

export type KnowledgeEmbedding = {
  chunk_id: string;
  embedding_version: string;
  embedding_model: string;
  embedding_dimensions: number;
  embedding: string;
  created_at: string;
};

export type KnowledgeApiSymbol = {
  id: number;
  symbol: string;
  symbol_lower: string;
  parent: string | null;
  member: string | null;
  symbol_kind: string;
  partition: string | null;
  source_id: string;
  chunk_id: string | null;
  deprecated: boolean;
  summary: string | null;
  created_at: string;
};

export type KnowledgeCodeExample = {
  example_id: string;
  source_id: string;
  source_repository: string;
  source_commit: string;
  source_path: string;
  source_url: string | null;
  language: string | null;
  code: string;
  context: string | null;
  authority: string;
  license: string;
  api_symbols: string[];
  symbols_text: string;
  created_at: string;
};

export type KnowledgeRetrievalLog = {
  id: string;
  owner_id: string | null;
  project_id: string | null;
  query: string;
  detected_symbols: string[] | null;
  filters: Json;
  strategy: string | null;
  result_count: number;
  top_score: number | null;
  latency_ms: number | null;
  created_at: string;
};

/**
 * Agent layer (Step 7).
 *
 * Type aliases, not interfaces — an interface has no implicit index signature
 * and fails postgrest-js's Record<string, unknown> constraint, which makes every
 * query on it silently resolve to `never`.
 */
export type AgentRun = {
  id: string;
  owner_id: string;
  project_id: string;
  conversation_id: string | null;
  ai_request_id: string | null;
  mode: "preview" | "apply";
  model_id: string;
  classification: string;
  requires_plan: boolean;
  state: string;
  cancelled: boolean;
  step_count: number;
  repair_attempts: number;
  tool_calls: number;
  retrieval_ms: number | null;
  generation_ms: number | null;
  validation_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  credits_charged: number;
  error_category: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AgentStep = {
  id: number;
  run_id: string;
  owner_id: string;
  step_index: number;
  previous_state: string;
  new_state: string;
  reason: string;
  created_at: string;
};

export type AgentToolCall = {
  id: number;
  run_id: string;
  owner_id: string;
  tool_name: string;
  agent_state: string;
  ok: boolean;
  duration_ms: number;
  summary: string;
  error_category: string | null;
  created_at: string;
};

export type AgentChangesetRow = {
  id: string;
  run_id: string;
  owner_id: string;
  project_id: string;
  status: string;
  operations: unknown[];
  issues: unknown[];
  operation_count: number;
  created_at: string;
  approved_at: string | null;
  applied_at: string | null;
};

export type GameBlueprintRow = {
  id: string;
  project_id: string;
  owner_id: string;
  idea: string;
  questions: unknown[];
  answers: unknown[];
  blueprint: unknown | null;
  issues: unknown[];
  status: "questions" | "draft" | "approved" | "superseded";
  version: number;
  input_tokens: number;
  output_tokens: number;
  credits_charged: number;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

/**
 * Project memory — durable per-project context the agent carries between
 * conversations. Live facts are those with `superseded_by` null; a correction
 * points the old row forward rather than rewriting it.
 */
export type ProjectMemoryRow = {
  id: string;
  project_id: string;
  owner_id: string;
  kind: "decision" | "constraint" | "preference" | "terminology" | "fact";
  content: string;
  source: "agent" | "user" | "blueprint";
  source_run_id: string | null;
  source_message_id: string | null;
  superseded_by: string | null;
  superseded_at: string | null;
  content_key: string;
  created_at: string;
  updated_at: string;
};

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      credit_balances: TableDef<CreditBalance>;
      credit_transactions: TableDef<CreditTransaction>;
      projects: TableDef<Project>;
      project_files: TableDef<ProjectFile>;
      file_revisions: TableDef<FileRevision>;
      conversations: TableDef<Conversation>;
      messages: TableDef<MessageRow>;
      ai_requests: TableDef<AiRequest>;
      activity_events: TableDef<ActivityEvent>;
      studio_connections: TableDef<StudioConnection>;
      studio_commands: TableDef<StudioCommand>;
      knowledge_sources: TableDef<KnowledgeSource>;
      knowledge_documents: TableDef<KnowledgeDocument>;
      knowledge_chunks: TableDef<KnowledgeChunk>;
      knowledge_embeddings: TableDef<KnowledgeEmbedding>;
      knowledge_api_symbols: TableDef<KnowledgeApiSymbol>;
      knowledge_code_examples: TableDef<KnowledgeCodeExample>;
      knowledge_retrieval_logs: TableDef<KnowledgeRetrievalLog>;
      agent_runs: TableDef<AgentRun>;
      agent_steps: TableDef<AgentStep, Omit<AgentStep, "id" | "created_at">>;
      agent_tool_calls: TableDef<AgentToolCall, Omit<AgentToolCall, "id" | "created_at">>;
      agent_changesets: TableDef<AgentChangesetRow>;
      game_blueprints: TableDef<GameBlueprintRow, Partial<GameBlueprintRow>>;
      project_memory: TableDef<ProjectMemoryRow, Partial<ProjectMemoryRow>>;
    };
    Views: Record<never, never>;
    Functions: {
      consume_credits: {
        // No p_user_id by design — the function reads auth.uid().
        Args: {
          p_amount: number;
          p_description?: string | null;
          p_reference_id?: string | null;
        };
        Returns: number;
      };
      knowledge_symbol_lookup: {
        Args: { p_symbols: string[]; p_limit?: number };
        Returns: Record<string, unknown>[];
      };
      knowledge_lexical_search: {
        Args: { p_query: string; p_limit?: number; p_category?: string | null; p_source_type?: string | null };
        Returns: Record<string, unknown>[];
      };
      knowledge_vector_search: {
        Args: { p_embedding: string; p_version: string; p_limit?: number; p_category?: string | null; p_source_type?: string | null };
        Returns: Record<string, unknown>[];
      };
      knowledge_code_search: {
        Args: { p_query: string; p_symbols?: string[]; p_limit?: number };
        Returns: Record<string, unknown>[];
      };
      knowledge_pending_chunks: {
        Args: { p_version: string; p_limit?: number; p_after?: string };
        Returns: { id: string; title: string | null; symbols_text: string; content: string }[];
      };
      grant_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_kind?: string;
          p_description?: string | null;
        };
        Returns: number;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
