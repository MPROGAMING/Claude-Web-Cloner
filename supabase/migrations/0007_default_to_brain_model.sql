-- ===========================================================================
-- Point the stored model defaults at the Roblox Brain model.
--
-- `projects.model_id` and `profiles.default_model_id` both defaulted to
-- 'anthropic:claude-sonnet-4-5'. Both columns are NOT NULL, so every new row
-- carried that value whether or not the user ever opened the model selector —
-- which meant application code could not tell "chose Anthropic" from "never
-- chose anything", and a deployment configured only for OpenRouter silently
-- generated on whichever model happened to be flagged `recommended`.
--
-- Found in Step 6 by reading model_id back out of `ai_requests` after a real
-- billed request: retrieval, streaming and billing were all correct, and the
-- model was still not the configured one.
--
-- Existing rows are deliberately left alone. A row holding the old value may
-- represent a real choice, and there is no way to distinguish that from an
-- untouched default after the fact — silently repointing someone's project at a
-- different (and more expensive) model is not a migration's call to make. The
-- runtime fallback in `pickUsableModel` already handles an unrunnable stored
-- choice, so those projects work without being rewritten.
-- ===========================================================================

alter table public.projects
  alter column model_id set default 'openrouter:openai/gpt-5.6-sol';

alter table public.profiles
  alter column default_model_id set default 'openrouter:openai/gpt-5.6-sol';
