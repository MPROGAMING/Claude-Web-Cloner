/**
 * Roblox API symbol detection.
 *
 * Programming retrieval fails on semantics alone: "Players.PlayerAdded" must
 * hit the exact Engine API entry, not merely a page that talks about players.
 * This module recognises Roblox symbols in free text so the retriever can add
 * an exact-match branch and boost it hard.
 */

/** Services and globals worth recognising even when written bare. */
export const WELL_KNOWN_ROOTS = [
  "Players", "ReplicatedStorage", "ServerScriptService", "ServerStorage",
  "StarterGui", "StarterPlayer", "Workspace", "workspace", "Lighting",
  "RunService", "TweenService", "DataStoreService", "MemoryStoreService",
  "CollectionService", "HttpService", "UserInputService", "ContextActionService",
  "MarketplaceService", "TeleportService", "PathfindingService", "SoundService",
  "PhysicsService", "Debris", "TextService", "TextChatService", "BadgeService",
  "MessagingService", "PolicyService", "AssetService", "InsertService",
  "GroupService", "AnalyticsService", "ProximityPromptService", "Chat",
  "GuiService", "StarterPack", "Teams", "VRService", "HapticService",
] as const;

/** Common instance/datatype names that appear as bare words. */
export const WELL_KNOWN_TYPES = [
  "RemoteEvent", "RemoteFunction", "BindableEvent", "BindableFunction",
  "CFrame", "Vector3", "Vector2", "UDim2", "UDim", "Color3", "BrickColor",
  "Ray", "RaycastParams", "RaycastResult", "Region3", "TweenInfo", "NumberRange",
  "NumberSequence", "ColorSequence", "Instance", "BasePart", "Part", "MeshPart",
  "Humanoid", "HumanoidRootPart", "Model", "Folder", "ScreenGui", "Frame",
  "TextLabel", "TextButton", "ImageLabel", "ImageButton", "ScrollingFrame",
  "UIListLayout", "UIGridLayout", "UICorner", "UIPadding", "Tool", "Accessory",
  "Animation", "AnimationTrack", "Animator", "Attachment", "Motor6D", "Weld",
  "WeldConstraint", "AlignPosition", "AlignOrientation", "BodyVelocity",
  "LinearVelocity", "AngularVelocity", "VectorForce", "ProximityPrompt",
  "ClickDetector", "SurfaceGui", "BillboardGui", "Beam", "Trail", "ParticleEmitter",
  "PointLight", "SpotLight", "SurfaceLight", "Sound", "SoundGroup",
  "DataStore", "OrderedDataStore", "GlobalDataStore", "Player", "Character",
  "Camera", "Terrain", "Seat", "VehicleSeat", "SpawnLocation", "Script",
  "LocalScript", "ModuleScript", "StringValue", "IntValue", "NumberValue",
  "BoolValue", "ObjectValue", "CFrameValue", "Vector3Value", "Configuration",
] as const;

const ROOTS = new Set<string>([...WELL_KNOWN_ROOTS, ...WELL_KNOWN_TYPES]);

/** `Players.PlayerAdded`, `Instance.new`, `workspace.Terrain` */
const DOTTED = /\b([A-Z][A-Za-z0-9]{2,}|workspace)\.([A-Za-z][A-Za-z0-9]*)\b/g;
/** `RemoteEvent:FireServer`, `Humanoid:MoveTo` */
const COLON = /\b([A-Z][A-Za-z0-9]{2,})\s*:\s*([A-Za-z][A-Za-z0-9]*)\b/g;
/** `Enum.HumanoidStateType.Running` */
const ENUM = /\bEnum\.([A-Za-z][A-Za-z0-9]*)(?:\.([A-Za-z][A-Za-z0-9]*))?\b/g;
/** Bare well-known names. */
const BARE = /\b([A-Za-z][A-Za-z0-9]{2,})\b/g;

export interface DetectedSymbol {
  symbol: string;
  parent?: string;
  member?: string;
  /** How confident we are this is a real API reference, 0..1. */
  confidence: number;
  form: "dotted" | "colon" | "enum" | "bare";
}

/**
 * Extract Roblox API symbols from arbitrary text.
 *
 * Dotted and colon forms are high confidence because their shape is
 * distinctive. Bare words are only accepted from the known lists — otherwise
 * ordinary English words become phantom symbols and poison the ranking.
 */
export function detectSymbols(text: string): DetectedSymbol[] {
  const found = new Map<string, DetectedSymbol>();
  const put = (s: DetectedSymbol) => {
    const existing = found.get(s.symbol);
    if (!existing || existing.confidence < s.confidence) found.set(s.symbol, s);
  };

  for (const m of text.matchAll(ENUM)) {
    const symbol = m[2] ? `Enum.${m[1]}.${m[2]}` : `Enum.${m[1]}`;
    put({ symbol, parent: `Enum.${m[1]}`, member: m[2], confidence: 0.95, form: "enum" });
  }

  for (const m of text.matchAll(DOTTED)) {
    if (m[1] === "Enum") continue;
    put({
      symbol: `${m[1]}.${m[2]}`,
      parent: m[1],
      member: m[2],
      confidence: ROOTS.has(m[1]) ? 0.95 : 0.7,
      form: "dotted",
    });
  }

  for (const m of text.matchAll(COLON)) {
    put({
      symbol: `${m[1]}:${m[2]}`,
      parent: m[1],
      member: m[2],
      confidence: ROOTS.has(m[1]) ? 0.95 : 0.7,
      form: "colon",
    });
  }

  for (const m of text.matchAll(BARE)) {
    const word = m[1];
    if (!ROOTS.has(word)) continue;
    put({ symbol: word, parent: word, confidence: 0.6, form: "bare" });
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Symbols worth indexing from a chunk's own content. */
export function extractIndexableSymbols(text: string, limit = 40): string[] {
  return detectSymbols(text)
    .filter((s) => s.confidence >= 0.6)
    .slice(0, limit)
    .map((s) => s.symbol);
}

/**
 * Does the query look like it is asking about a specific API rather than how
 * to build something? Drives whether exact-match dominates the ranking.
 */
export function looksLikeApiLookup(query: string): boolean {
  const symbols = detectSymbols(query);
  if (symbols.some((s) => s.form === "dotted" || s.form === "colon" || s.form === "enum")) return true;
  return /\b(parameters?|arguments?|returns?|signature|properties|methods|events|api|overload)\b/i.test(query)
    && symbols.length > 0;
}

/** Is the user explicitly asking about deprecated/legacy APIs? */
export function wantsDeprecated(query: string): boolean {
  return /\b(deprecat\w*|legacy|obsolete|removed|old\s+api|superseded)\b/i.test(query);
}

/** Rough token estimate. Deliberately cheap — used only for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
