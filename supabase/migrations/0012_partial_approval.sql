-- ===========================================================================
-- Partial approval.
--
-- A change set was all-or-nothing: the review dialog offered "Approve and
-- apply" or "Close", and nothing else. If the agent got three files right and
-- was wrong to delete a fourth, the only options were to accept the bad delete
-- or throw away every good change and re-prompt. A critic comparing this
-- surface to Cursor named it as the one thing that made the review theatre
-- rather than review.
--
-- The safety invariant is unchanged and this is why the column exists rather
-- than the operations being rewritten in place: approval is still a recorded,
-- explicit act tied to a concrete list, and apply still replays exactly that
-- list. It is now a named subset instead of an implied whole, and the original
-- proposal stays intact next to it so the two can be compared afterwards.
--
-- NULL means "every operation", which is what every existing row means. That
-- keeps the old behaviour exact rather than backfilling a guess.
-- ===========================================================================

alter table public.agent_changesets
  add column approved_paths text[];

comment on column public.agent_changesets.approved_paths is
  'Paths the user actually approved. NULL means all operations, which is what every row created before partial approval means.';
