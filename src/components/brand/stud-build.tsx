/**
 * The signature mark: a place assembling itself out of studded blocks.
 *
 * Studs are the one piece of visual vocabulary that is unmistakably Roblox —
 * more so than any colour or logo — so the identity is built from the material
 * rather than from another glowing gradient. The isometric projection and the
 * light coming from underneath are the "forge" half of Blockwright: a workshop
 * at night, not a dashboard.
 *
 * Pure SVG so it costs nothing to load, scales to any size, and animates on the
 * compositor. The build order is deliberate — ground, then structure, then the
 * pieces that read as gameplay — because it is telling the same story the
 * product does.
 */

interface Block {
  /** Grid coordinates; z is height in block units. */
  x: number;
  y: number;
  z: number;
  w?: number;
  d?: number;
  h?: number;
  tone: "stone" | "ember" | "deep" | "accent";
  /** Order in the assembly sequence. */
  beat: number;
  studs?: boolean;
}

const TILE_W = 46;
const TILE_H = 23;
const UNIT_H = 26;

/** Isometric 2:1 projection. */
function project(x: number, y: number, z: number) {
  return {
    px: (x - y) * (TILE_W / 2),
    py: (x + y) * (TILE_H / 2) - z * UNIT_H,
  };
}

const TONES = {
  stone: { top: "#6a625a", left: "#443e38", right: "#2d2925" },
  deep: { top: "#4d473f", left: "#332e29", right: "#201d1a" },
  ember: { top: "#f08a3c", left: "#c05a1e", right: "#7d3411" },
  accent: { top: "#57b3bd", left: "#357f88", right: "#20545b" },
} as const;

/**
 * One block: three visible faces plus studs on the top.
 *
 * Studs are drawn as ellipses matched to the isometric grid so they sit on the
 * top face correctly rather than looking pasted on.
 */
function Brick({ block }: { block: Block }) {
  const w = block.w ?? 1;
  const d = block.d ?? 1;
  const h = block.h ?? 1;
  const tone = TONES[block.tone];

  const { px, py } = project(block.x, block.y, block.z);

  const halfW = (TILE_W / 2) * w;
  const halfD = (TILE_W / 2) * d;
  const qtrW = (TILE_H / 2) * w;
  const qtrD = (TILE_H / 2) * d;
  const height = UNIT_H * h;

  // Top face diamond, from the block's back corner.
  const top = `${px},${py} ${px + halfW},${py + qtrW} ${px + halfW - halfD},${py + qtrW + qtrD} ${px - halfD},${py + qtrD}`;
  const left = `${px - halfD},${py + qtrD} ${px - halfD},${py + qtrD + height} ${px + halfW - halfD},${py + qtrW + qtrD + height} ${px + halfW - halfD},${py + qtrW + qtrD}`;
  const right = `${px + halfW - halfD},${py + qtrW + qtrD} ${px + halfW - halfD},${py + qtrW + qtrD + height} ${px + halfW},${py + qtrW + height} ${px + halfW},${py + qtrW}`;

  const studs: { cx: number; cy: number }[] = [];
  if (block.studs !== false) {
    for (let i = 0; i < w; i += 1) {
      for (let j = 0; j < d; j += 1) {
        const c = project(block.x + i + 0.5, block.y + j + 0.5, block.z);
        studs.push({ cx: c.px, cy: c.py });
      }
    }
  }

  return (
    <g
      className="stud-brick"
      style={{ animationDelay: `${block.beat * 90}ms` }}
      /* Transform origin at the block keeps the drop-in reading as gravity. */
    >
      <polygon points={left} fill={tone.left} />
      <polygon points={right} fill={tone.right} />
      <polygon points={top} fill={tone.top} />
      {studs.map((stud, index) => (
        <g key={index}>
          <ellipse cx={stud.cx} cy={stud.cy - 3} rx={7} ry={3.5} fill={tone.top} />
          <ellipse
            cx={stud.cx}
            cy={stud.cy - 4.6}
            rx={7}
            ry={3.5}
            fill={tone.top}
            style={{ filter: "brightness(1.22)" }}
          />
        </g>
      ))}
    </g>
  );
}

/**
 * Sorted back-to-front so nearer blocks overdraw farther ones. Painter's
 * algorithm is enough here and avoids any z-index bookkeeping in the markup.
 */
const BLOCKS: Block[] = (
  [
    // Ground plate
    { x: 0, y: 0, z: 0, w: 4, d: 4, h: 0.35, tone: "deep", beat: 0, studs: false },

    // Keep
    { x: 0, y: 0, z: 0.35, w: 2, d: 2, h: 1, tone: "stone", beat: 2 },
    { x: 0, y: 0, z: 1.35, w: 1, d: 1, h: 1, tone: "stone", beat: 5 },
    { x: 1, y: 1, z: 1.35, w: 1, d: 1, h: 0.6, tone: "stone", beat: 6 },

    // Forge floor — the light source of the composition
    { x: 2.2, y: 0, z: 0.35, w: 1.6, d: 1, h: 0.5, tone: "ember", beat: 3 },
    { x: 0, y: 2.2, z: 0.35, w: 1, d: 1.6, h: 0.5, tone: "ember", beat: 4 },

    // Outlying platforms — gameplay, not architecture
    { x: 2.4, y: 2.4, z: 0.35, w: 1.4, d: 1.4, h: 0.8, tone: "stone", beat: 7 },
    { x: 2.75, y: 2.75, z: 1.15, w: 0.7, d: 0.7, h: 0.5, tone: "accent", beat: 9 },
    { x: -1.3, y: 1.2, z: 0.35, w: 1, d: 1, h: 0.45, tone: "deep", beat: 8 },
  ] as Block[]
).sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);

export function StudBuild({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-150 -110 300 250"
      className={className}
      role="img"
      aria-label="An isometric Roblox-style structure assembling out of studded blocks"
    >
      <defs>
        <radialGradient id="forge-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.5" />
          <stop offset="60%" stopColor="var(--ember)" stopOpacity="0.11" />
          <stop offset="100%" stopColor="var(--ember)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Light from beneath the plate, so the structure sits in the glow rather
          than having a glow drawn behind it. */}
      <ellipse cx="0" cy="86" rx="150" ry="58" fill="url(#forge-glow)" />

      {BLOCKS.map((block, index) => (
        <Brick key={index} block={block} />
      ))}
    </svg>
  );
}
