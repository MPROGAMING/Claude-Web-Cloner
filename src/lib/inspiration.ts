/**
 * Inspiration — mechanics a creator can ask for, written the way a player
 * would describe them.
 *
 * This is not a catalogue of products. Nothing here is a genre, a starter
 * pack or a thing you "choose"; each entry is one sentence describing what
 * happens in the game, offered inside the conversation as a way to start
 * talking. The agent builds it from the sentence, so nothing goes stale
 * against the current Roblox API and no pre-written code ships unreviewed.
 *
 * Pure module: no database, no `server-only`, no randomness. `mechanicsFor`
 * is deterministic because the empty state renders on the server and hydrates
 * on the client, and a different four chips on each side is a hydration
 * mismatch.
 */

export type Mechanic = {
  id: string;
  /** What is actually sent — a full, buildable request in play language. */
  prompt: string;
  /** Chip caption. Two to four words, same voice as the prompt. */
  label: string;
};

export const MECHANICS: readonly Mechanic[] = [
  {
    id: "lava-checkpoints",
    label: "Lava and checkpoints",
    prompt:
      "Lava that kills you the moment you touch it, and checkpoint flags that remember the last one you reached so you come back there instead of the start.",
  },
  {
    id: "respawning-coins",
    label: "Coins that come back",
    prompt:
      "Coins scattered around the map that disappear when someone grabs one and reappear in the same spot eight seconds later.",
  },
  {
    id: "sprint-stamina",
    label: "Sprint with stamina",
    prompt:
      "Sprinting on Shift, with a stamina bar that drains while you run, drops you back to a walk when it empties, and refills while you stand still.",
  },
  {
    id: "double-jump",
    label: "A second jump",
    prompt:
      "A double jump you can use once while you are already in the air, with a little puff of particles at your feet, that becomes available again the moment you land.",
  },
  {
    id: "day-night",
    label: "Night falls, lights on",
    prompt:
      "A day that fades into night over ten minutes and back again, with lamps around the map that switch themselves on at dusk and off at dawn.",
  },
  {
    id: "coin-shop",
    label: "Spend coins on speed",
    prompt:
      "A shop you walk up to that spends your coins on running faster and jumping higher, and still remembers what you bought when you come back tomorrow.",
  },
  {
    id: "chaser",
    label: "Something chasing you",
    prompt:
      "A monster that wanders the map on its own until it spots a player, then chases whoever is closest, and gives up ten seconds after it loses sight of them.",
  },
  {
    id: "last-standing",
    label: "Last one standing",
    prompt:
      "A two-minute round where everyone is teleported into the arena, the floor falls away one tile at a time, and the last player still standing wins before it all resets.",
  },
  {
    id: "locked-door",
    label: "Doors that need a key",
    prompt:
      "A locked door that only opens for a player carrying the matching key, with the key hidden somewhere else on the map and dropped on the floor if its holder dies.",
  },
  {
    id: "capture-the-flag",
    label: "Capture the flag",
    prompt:
      "Two teams in different colours with a flag each, and a point scored when you carry the other team's flag all the way back to your own base.",
  },
  {
    id: "pickup-sword",
    label: "Pick up and swing",
    prompt:
      "A sword lying on the ground that you can pick up and swing by clicking, which knocks another player back a few studs when it connects.",
  },
  {
    id: "all-time-board",
    label: "Top ten forever",
    prompt:
      "A board on a wall showing the ten highest scores anyone has ever set, still there after the server shuts down and starts again.",
  },
  {
    id: "moving-platforms",
    label: "Platforms that move",
    prompt:
      "Platforms that slide back and forth along a set path and carry you with them, instead of sliding out from under your feet.",
  },
  {
    id: "follower-pet",
    label: "A pet that follows",
    prompt:
      "A pet that floats just behind you and bobs as it moves, catches up when you run ahead, and reappears next to you if it falls too far behind.",
  },
  {
    id: "underwater-air",
    label: "Hold your breath",
    prompt:
      "Deep water that starts an air meter counting down once your head goes under, and starts hurting you when it runs out until you get back to the surface.",
  },
  {
    id: "boost-pads",
    label: "Speed pads on the floor",
    prompt:
      "Glowing pads on the floor that fling you forward for three seconds, then go dark for a while before anyone can use that pad again.",
  },
];

const SLICE = 4;

/**
 * Four mechanics, rotated by `seed`.
 *
 * The same seed always yields the same four — a project's chips do not
 * reshuffle under the person reading them, and the server and the client
 * agree. With no seed the list starts at the top.
 */
export function mechanicsFor(seed?: string): Mechanic[] {
  const start = seed ? hash(seed) % MECHANICS.length : 0;
  return Array.from({ length: SLICE }, (_, i) => MECHANICS[(start + i) % MECHANICS.length]);
}

/** FNV-1a, kept to 32 bits so the arithmetic stays exact in a double. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
