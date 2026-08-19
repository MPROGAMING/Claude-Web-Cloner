import { BlueprintView } from "blockwright";

// Data shapes come straight from src/lib/blueprint/schema.ts — blueprintSchema
// (title, pitch, genre, scope, estimated_scripts, sections[{key, summary,
// decisions, roblox}], out_of_scope, first_milestone) and BlueprintIssue
// ({severity, message, section}). Section keys are from SECTION_KEYS.
//
// This is the plan a creator reviews before anything is built; sections are
// independently regenerable because approval is per-decision in practice.
const BLUEPRINT = {
  title: "Bloxburg Tycoon",
  pitch:
    "Build a factory floor, automate it, and race the clock to clear each shipping quota.",
  genre: "Tycoon",
  scope: "medium" as const,
  estimated_scripts: 14,
  sections: [
    {
      key: "concept" as const,
      summary:
        "A single-player factory floor that the player extends outward from a starter conveyor. Money comes from filling shipping quotas on a timer, so the pressure is throughput rather than combat. Every purchase is a permanent change to the plot, which is what makes the space feel earned.",
      decisions: [
        "One plot per player, 64×64 studs, no shared building",
        "Quotas arrive every 90 seconds and scale with total machine count",
        "Nothing decays — a built machine stays built",
      ],
      roblox: ["Workspace", "ServerScriptService", "ReplicatedStorage"],
    },
    {
      key: "core_loop" as const,
      summary:
        "Place a machine, watch it feed the next one, sell the output, buy a better machine. The loop tightens as quotas grow: early on one conveyor is enough, and by the fourth quota the player is routing three lines into a shared packer.",
      decisions: [
        "Place → produce → ship → upgrade, on a 90 second quota cycle",
        "Machines snap to a 4-stud grid so lines always align",
        "Selling is automatic at the packer, not a manual click",
      ],
      roblox: ["RunService", "CollectionService"],
    },
    {
      key: "systems" as const,
      summary:
        "Three server-owned systems: a placement validator, a production tick, and the quota scheduler. The client only ever sends a placement request and renders what the server confirms.",
      decisions: [
        "Placement is validated server-side against plot bounds and overlap",
        "Production ticks once per second on the server, batched per plot",
        "QuotaService fires a RemoteEvent when a quota opens or expires",
      ],
      roblox: ["RemoteEvent", "RemoteFunction", "ServerScriptService"],
    },
    {
      key: "networking" as const,
      summary:
        "The server owns money, machine state and quota timing. Clients send intent and receive confirmations, so a modified client cannot mint currency or place outside its plot.",
      decisions: [
        "Server authoritative for money, placement and quota progress",
        "Client sends placement intent only; server confirms or rejects",
        "Tick updates are throttled to 4 per second per player",
      ],
      roblox: ["RemoteEvent", "Players"],
    },
    {
      key: "persistence" as const,
      summary:
        "Plot layout and money save on a 60 second autosave and on leave. Layout is stored as a compact array of machine ids and grid coordinates rather than full instances.",
      decisions: [
        "DataStore key is the player's UserId",
        "Autosave every 60 seconds and on PlayerRemoving",
        "Layout stored as {machineId, gx, gy} triples",
      ],
      roblox: ["DataStoreService", "Players"],
    },
    {
      key: "ui" as const,
      summary:
        "A bottom shop bar and a top quota strip. Nothing else is on screen while the player is building, because the plot is the interface.",
      decisions: [
        "Shop bar is a horizontal scroller, thumb-sized targets on mobile",
        "Quota strip shows remaining time and units in one row",
        "No modal windows during a live quota",
      ],
      roblox: ["StarterGui", "ScreenGui"],
    },
  ],
  out_of_scope: [
    "Multiplayer plots or visiting other players",
    "Trading between players",
    "Prestige or rebirth",
  ],
  first_milestone:
    "One conveyor, one packer and one quota. The player can place a conveyor, see a part travel along it, watch it sell at the packer, and fill a single 10-unit quota before the timer runs out. No shop, no saving, no upgrades.",
};

const ISSUES = [
  {
    severity: "warning" as const,
    message: "Economy states no concrete decisions.",
    section: "economy" as const,
  },
  {
    severity: "warning" as const,
    message: "Interface does not say what happens on a phone in portrait.",
    section: "ui" as const,
  },
];

export const UnderReview = () => (
  <BlueprintView
    blueprintId="bp_bloxburg_tycoon"
    blueprint={BLUEPRINT}
    issues={[]}
    approved={false}
  />
);

export const WithIssues = () => (
  <BlueprintView
    blueprintId="bp_bloxburg_tycoon"
    blueprint={BLUEPRINT}
    issues={ISSUES}
    approved={false}
  />
);

export const Approved = () => (
  <BlueprintView
    blueprintId="bp_bloxburg_tycoon"
    blueprint={BLUEPRINT}
    issues={[]}
    approved
  />
);

// Scope is an honest signal about what is being approved, and it is the one
// field that changes the header's tone.
export const LargeScope = () => (
  <BlueprintView
    blueprintId="bp_sword_fight_arena"
    blueprint={{
      ...BLUEPRINT,
      title: "Sword Fight Arena",
      genre: "Fighting",
      pitch: "Round-based sword duels on rotating maps, with a lobby between rounds.",
      scope: "large",
      estimated_scripts: 31,
    }}
    issues={[]}
    approved={false}
  />
);
