import { ModelWall } from "blockwright";

// Rendered straight from src/lib/ai/registry.ts — every enabled model, grouped
// into the three tiers, with the default marked. Nothing to configure: className
// is the only prop, and the content cannot drift from what the workspace model
// picker actually offers.
export const ByTier = () => <ModelWall />;
