/**
 * Starter templates.
 *
 * A template is a *prompt plus a visual identity*, not a pile of pre-written
 * files. The agent still generates everything, so a template never goes stale
 * against the current Roblox API and never ships code nobody reviewed.
 *
 * Artwork: every template's hero image is generated from `art` by
 * `components/marketing/template-art.tsx` — original geometric SVG scenes drawn
 * from this metadata. Nothing is stock photography and nothing is fetched at
 * runtime, so there are no licensing questions, no broken images, and no
 * layout shift.
 */

export type TemplateCategory =
  | "Simulator"
  | "Obby"
  | "Tycoon"
  | "Horror"
  | "Survival"
  | "PvP"
  | "Tower Defense"
  | "RPG"
  | "Racing"
  | "Social"
  | "Story"
  | "Strategy";

/**
 * Icon backing the card, named from the Game Icons set (game-icons.net) as
 * bundled by `react-icons/gi`. Real third-party game artwork under CC BY 3.0 —
 * see `components/marketing/template-art.tsx` for the attribution note.
 */
export type ArtIcon =
  | "GiCrystalGrowth"
  | "GiJumpAcross"
  | "GiFactory"
  | "GiGhost"
  | "GiCampfire"
  | "GiCrossedSwords"
  | "GiTowerFlag"
  | "GiScrollUnfurled"
  | "GiRaceCar"
  | "GiThreeFriends"
  | "GiOpenBook"
  | "GiChessRook";

export interface Template {
  slug: string;
  name: string;
  tagline: string;
  category: TemplateCategory;
  /** Lucide icon name rendered on the card chip. */
  icon: string;
  /** Game Icons glyph shown in the card hero. */
  art: ArtIcon;
  /** Two oklch stops driving the art gradient and the card accent. */
  accent: [string, string];
  imageAlt: string;
  /**
   * A real Roblox capture for this genre, when one exists.
   *
   * Most cards carry generated glyph art, which is honest decoration. Where a
   * place has actually been built and captured in Studio, the card shows that
   * instead — a critic comparing us to a competitor made the point that its
   * genre cards all resolved to decorative assets rather than user output, and
   * the same criticism lands here for every card that has no `capture`.
   *
   * Nothing here claims a prompt produced the image. The card labels it as a
   * place built in Studio, which is what it is.
   */
  capture?: { src: string; alt: string; focal?: string };
  /** Seeded into the composer when a project is created from this template. */
  prompt: string;
  highlights: string[];
  tags: string[];
  estimatedFiles: number;
  featured?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    slug: "crystal-simulator",
    name: "Collect & Sell Simulator",
    tagline: "Gather a resource, sell it, buy upgrades, unlock the next area.",
    category: "Simulator",
    icon: "gem",
    art: "GiCrystalGrowth",
    accent: ["oklch(0.72 0.16 200)", "oklch(0.62 0.19 280)"],
    imageAlt: "Abstract scene of floating crystal shards above a collection pad",
    prompt:
      "Build a simulator where players collect crystals from nodes around the map, carry them in a backpack with a capacity limit, sell them at a shop for coins, and spend coins on bigger backpacks and faster collection. Add three unlockable islands gated behind coin thresholds, with a teleport pad for each. Persist coins, backpack level and unlocked islands with DataStore.",
    highlights: ["Currency + backpack capacity", "Shop with upgrade tiers", "Gated area unlocks", "DataStore saves"],
    tags: ["economy", "progression", "datastore"],
    estimatedFiles: 9,
    featured: true,
  },
  {
    slug: "obby-checkpoints",
    name: "Obby with Checkpoints",
    tagline: "Staged obstacle course with respawns and a live leaderboard.",
    category: "Obby",
    icon: "flag",
    art: "GiJumpAcross",
    accent: ["oklch(0.78 0.16 85)", "oklch(0.66 0.19 35)"],
    imageAlt: "Abstract scene of ascending platforms with a checkpoint flag",
    prompt:
      "Build an obby system: numbered checkpoint pads that save a player's stage, respawn at the last checkpoint on death, a leaderstats display showing the current stage, kill bricks that reset the player to their checkpoint, and a leaderboard of the highest stage reached. Persist stage progress across sessions.",
    highlights: ["Checkpoint capture", "Respawn routing", "Kill bricks", "Persistent stage"],
    tags: ["platforming", "leaderboard"],
    estimatedFiles: 7,
    featured: true,
  },
  {
    slug: "tycoon-core",
    name: "Tycoon Core Loop",
    tagline: "Droppers, conveyors, collectors and buyable expansions.",
    category: "Tycoon",
    icon: "factory",
    art: "GiFactory",
    accent: ["oklch(0.74 0.15 145)", "oklch(0.6 0.16 195)"],
    imageAlt: "Abstract scene of a conveyor belt carrying value blocks to a collector",
    prompt:
      "Build a tycoon: each player claims a plot, droppers spawn value parts onto a conveyor, a collector converts them to cash, and buy-buttons unlock new droppers and upgrades in a dependency order. Only the plot owner can trigger their own buttons — validate ownership on the server. Persist owned buttons and cash.",
    highlights: ["Plot claiming", "Dropper/collector loop", "Ordered buy buttons", "Server-side ownership"],
    tags: ["economy", "idle", "ownership"],
    estimatedFiles: 10,
    featured: true,
  },
  {
    slug: "horror-escape",
    name: "Horror Escape",
    tagline: "Stalked in the dark while you search for the way out.",
    category: "Horror",
    icon: "ghost",
    art: "GiGhost",
    capture: {
      src: "/demos/hero-corridor.jpg",
      alt: "A dark hotel corridor in Roblox lit by warm wall sconces, with numbered doors",
      focal: "50% 46%",
    },
    accent: ["oklch(0.5 0.14 300)", "oklch(0.3 0.1 265)"],
    imageAlt: "Abstract scene of a torch beam cutting through fog",
    prompt:
      "Build a horror escape round: players spawn in a dark map with a flashlight that has a battery meter, must find three keys hidden at randomised spawn points, and unlock the exit door. Add a roaming AI chaser using pathfinding that hunts the nearest player, a stamina-limited sprint, and a heartbeat UI that intensifies with proximity. Round ends when players escape or all are caught.",
    highlights: ["Flashlight + battery", "Randomised key spawns", "Pathfinding chaser", "Proximity tension UI"],
    tags: ["atmosphere", "ai", "rounds"],
    estimatedFiles: 10,
  },
  {
    slug: "survival-craft",
    name: "Survival & Crafting",
    tagline: "Gather, craft, build shelter, survive the night cycle.",
    category: "Survival",
    icon: "tent",
    art: "GiCampfire",
    accent: ["oklch(0.72 0.15 60)", "oklch(0.5 0.13 25)"],
    imageAlt: "Abstract scene of a campfire under a day-night arc",
    prompt:
      "Build a survival loop: hunger and health meters that drain over time, resource nodes for wood and stone that respawn, an inventory with stack limits, a crafting recipe system, placeable campfires that restore warmth, and a day/night cycle where nights are more dangerous. Persist inventory and stats.",
    highlights: ["Hunger + health meters", "Gatherable resources", "Recipe crafting", "Day/night cycle"],
    tags: ["crafting", "inventory", "cycle"],
    estimatedFiles: 11,
  },
  {
    slug: "round-arena",
    name: "Round-Based Arena",
    tagline: "Lobby, countdown, match, winner, repeat.",
    category: "PvP",
    icon: "swords",
    art: "GiCrossedSwords",
    accent: ["oklch(0.68 0.19 20)", "oklch(0.55 0.17 340)"],
    imageAlt: "Abstract scene of two opposing markers in a circular arena",
    prompt:
      "Build a round-based match system: players wait in a lobby, a countdown starts when enough players are present, everyone teleports to the arena, last player standing wins, then everyone returns to the lobby and the cycle repeats. Include a round state UI showing the phase and timer, and award coins to the winner.",
    highlights: ["Round state machine", "Lobby/arena teleports", "Phase timer UI", "Winner rewards"],
    tags: ["rounds", "combat", "matchmaking"],
    estimatedFiles: 8,
  },
  {
    slug: "tower-defense",
    name: "Tower Defense",
    tagline: "Place towers, hold the lane, survive escalating waves.",
    category: "Tower Defense",
    icon: "castle",
    art: "GiTowerFlag",
    accent: ["oklch(0.7 0.16 165)", "oklch(0.58 0.18 250)"],
    imageAlt: "Abstract scene of a winding lane with tower placements alongside",
    prompt:
      "Build a tower defense round: enemies spawn in waves and follow a waypoint path to a base with health, players spend cash to place towers on valid plots, towers acquire and damage the nearest enemy in range on a cooldown, and each cleared wave pays out and increases difficulty. Validate placement and purchases on the server.",
    highlights: ["Waypoint pathing", "Wave scaling", "Tower targeting", "Server-validated placement"],
    tags: ["strategy", "waves", "economy"],
    estimatedFiles: 11,
  },
  {
    slug: "rpg-quests",
    name: "RPG Quests & Levels",
    tagline: "XP, levels, quest chains and an NPC to take them from.",
    category: "RPG",
    icon: "scroll",
    art: "GiScrollUnfurled",
    capture: {
      src: "/demos/islands.jpg",
      alt: "Floating grass islands in Roblox joined by a rope bridge, with a stone arch and an open treasure chest",
      focal: "50% 54%",
    },
    accent: ["oklch(0.7 0.15 300)", "oklch(0.55 0.16 260)"],
    imageAlt: "Abstract scene of a quest marker above a branching path",
    prompt:
      "Build an RPG progression layer: XP and levels with a curve, an NPC quest giver with a dialogue UI, a quest log tracking active and completed objectives, kill/collect quest types that update on progress, and level-gated rewards. Persist level, XP and quest state.",
    highlights: ["XP curve + levels", "NPC dialogue", "Quest log", "Objective tracking"],
    tags: ["progression", "npc", "quests"],
    estimatedFiles: 10,
  },
  {
    slug: "racing-circuit",
    name: "Racing Circuit",
    tagline: "Checkpoints, lap timing and a personal best to beat.",
    category: "Racing",
    icon: "flag-triangle-right",
    art: "GiRaceCar",
    accent: ["oklch(0.76 0.16 105)", "oklch(0.6 0.18 155)"],
    imageAlt: "Abstract scene of a looping race track with a start line",
    prompt:
      "Build a racing system: a spawnable vehicle per player, ordered checkpoints that must be passed in sequence, lap counting and lap timing, a live position display, a countdown start, and a persistent personal best per track. Prevent checkpoint skipping on the server.",
    highlights: ["Ordered checkpoints", "Lap timing", "Live positions", "Persistent best time"],
    tags: ["vehicles", "timing", "leaderboard"],
    estimatedFiles: 9,
  },
  {
    slug: "social-hangout",
    name: "Social Hangout",
    tagline: "Emotes, seating, private booths and a party system.",
    category: "Social",
    icon: "users",
    art: "GiThreeFriends",
    accent: ["oklch(0.74 0.13 340)", "oklch(0.62 0.15 295)"],
    imageAlt: "Abstract scene of grouped figures around a social space",
    prompt:
      "Build a social hangout: an emote wheel with animations, sittable seats that snap the character, a party system where players invite each other by username and teleport together, and a nameplate showing party colour. All party mutations happen on the server.",
    highlights: ["Emote wheel", "Seating", "Party invites", "Group teleport"],
    tags: ["social", "emotes", "party"],
    estimatedFiles: 9,
  },
  {
    slug: "story-chapters",
    name: "Story Chapters",
    tagline: "Cutscenes, branching dialogue and saved chapter progress.",
    category: "Story",
    icon: "book-open",
    art: "GiOpenBook",
    accent: ["oklch(0.72 0.12 220)", "oklch(0.56 0.14 285)"],
    imageAlt: "Abstract scene of stacked dialogue panels along a story path",
    prompt:
      "Build a story mode: chapters that unlock in order, a typewriter dialogue UI with branching choices, camera cutscenes using TweenService between waypoints, a skip control, and saved progress so a returning player resumes at their chapter.",
    highlights: ["Chapter gating", "Branching dialogue", "Camera cutscenes", "Resume on return"],
    tags: ["narrative", "cutscene", "dialogue"],
    estimatedFiles: 9,
  },
  {
    slug: "base-strategy",
    name: "Base Strategy",
    tagline: "Build, defend, raid — with a real resource economy.",
    category: "Strategy",
    icon: "grid-3x3",
    art: "GiChessRook",
    accent: ["oklch(0.7 0.14 175)", "oklch(0.52 0.15 240)"],
    imageAlt: "Abstract scene of a tiled base grid with placed structures",
    prompt:
      "Build a base strategy loop: a grid-snapped placement system for structures, resource generators that accrue over time, structure health and a raid mode where another player can attack, plus a rebuild cost. Validate every placement and raid action on the server, and persist the base layout.",
    highlights: ["Grid placement", "Resource generators", "Raid mode", "Persistent layout"],
    tags: ["strategy", "building", "economy"],
    estimatedFiles: 12,
  },
];

export function getTemplate(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Simulator",
  "Obby",
  "Tycoon",
  "Tower Defense",
  "PvP",
  "Survival",
  "Horror",
  "RPG",
  "Racing",
  "Strategy",
  "Social",
  "Story",
];

export const FEATURED_TEMPLATES = TEMPLATES.filter((t) => t.featured);

export interface PromptSuggestion {
  /** Short chip text. Kept to roughly one line so the grid stays even. */
  label: string;
  /** What is actually sent — usually longer and more specific. */
  prompt: string;
}

/**
 * Prompt chips for a project's empty state, tuned to its template.
 *
 * The chip shows a short label while sending a fully-specified prompt, because
 * a good prompt is far too long to read as a button but a short button is far
 * too vague to build from.
 */
export function suggestionsFor(slug: string | null | undefined): PromptSuggestion[] {
  const template = slug ? getTemplate(slug) : undefined;

  if (template) {
    return [
      { label: `Build the ${template.category.toLowerCase()} core loop`, prompt: template.prompt },
      {
        label: "Add a leaderboard",
        prompt: `Add a global leaderboard to the ${template.name} showing the top ten players, backed by an OrderedDataStore and refreshed on an interval.`,
      },
      {
        label: "Add daily rewards",
        prompt:
          "Add a daily reward chest with a 24-hour cooldown per player, an escalating streak bonus, and server-side validation of the claim time.",
      },
      {
        label: "Polish the interface",
        prompt: `Build a cohesive dark HUD for the ${template.name}: a currency display, a progress indicator, and animated open/close transitions on every panel.`,
      },
    ];
  }

  return [
    {
      label: "Add a coin currency",
      prompt:
        "Add a coin currency with a leaderstats display, server-authoritative awards, and DataStore saving that survives a rejoin.",
    },
    {
      label: "Build a shop UI",
      prompt:
        "Create a shop UI where players spend coins on upgrades. Re-check the price and the player's balance on the server before granting anything.",
    },
    {
      label: "Add checkpoints",
      prompt:
        "Build a checkpoint system that saves each player's stage and respawns them at the last checkpoint they touched, persisting across sessions.",
    },
    {
      label: "Add daily rewards",
      prompt:
        "Add a daily reward chest with a 24-hour cooldown per player, an escalating streak bonus, and server-side validation of the claim time.",
    },
  ];
}
