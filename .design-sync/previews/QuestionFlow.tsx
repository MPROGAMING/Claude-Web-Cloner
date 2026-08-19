import { QuestionFlow } from "blockwright";

// Shapes from src/lib/blueprint/schema.ts questionSchema: {id, question, why,
// kind: "choice"|"multi"|"text", options: [{label, detail}], suggested}.
//
// One question per screen, and every option carries its consequence — the point
// is not to collect preferences but to let someone make an informed choice about
// a thing that is about to be built for them. `suggested` is preselected so the
// whole flow can be accepted by pressing Enter.
const QUESTIONS = [
  {
    id: "core-loop",
    question: "What does a player spend most of their time doing?",
    why: "This decides which systems get built first.",
    kind: "choice" as const,
    options: [
      { label: "Building and automating", detail: "Placement, production ticks, a shop." },
      { label: "Fighting other players", detail: "Combat, rounds, respawns, a lobby." },
      { label: "Running an obstacle course", detail: "Checkpoints, timers, a leaderboard." },
      { label: "Collecting and selling", detail: "Spawners, inventory, a sell zone." },
    ],
    suggested: "Building and automating",
  },
  {
    id: "players",
    question: "How many players share one server?",
    why: "Changes whether plots are private and how much the server tracks.",
    kind: "choice" as const,
    options: [
      { label: "One player per plot", detail: "Private plots, simplest to save." },
      { label: "Up to 12, shared world", detail: "One world, everyone sees everyone." },
      { label: "Teams of 4", detail: "Team state, shared objectives, a lobby." },
    ],
    suggested: "One player per plot",
  },
  {
    id: "saving",
    question: "What should be there when a player comes back tomorrow?",
    why: "Decides what goes into DataStore and how often.",
    kind: "multi" as const,
    options: [
      { label: "Their build", detail: "Machine layout saved as grid coordinates." },
      { label: "Their money", detail: "Currency balance, server-owned." },
      { label: "Their upgrades", detail: "Purchased tiers per machine type." },
      { label: "Nothing — fresh each time", detail: "No DataStore at all." },
    ],
    suggested: "Their build",
  },
  {
    id: "mobile",
    question: "Should this work well on a phone?",
    why: "Touch targets and camera controls change if yes.",
    kind: "choice" as const,
    options: [
      { label: "Yes, phone first", detail: "Thumb-sized controls, no hover states." },
      { label: "Playable but not tuned", detail: "Default Roblox mobile controls." },
      { label: "Desktop only", detail: "Keyboard shortcuts, dense UI." },
    ],
    suggested: "Yes, phone first",
  },
  {
    id: "name",
    question: "What is this called, for now?",
    why: "Used as the project name and the working title in the blueprint.",
    kind: "text" as const,
    options: [],
    suggested: null,
  },
];

export const FirstQuestion = () => (
  <QuestionFlow questions={QUESTIONS} onComplete={() => {}} onBack={() => {}} />
);

// A multi-select question, and one with no back step — the two shapes the flow
// renders differently.
export const MultiSelect = () => (
  <QuestionFlow questions={QUESTIONS.slice(2)} onComplete={() => {}} onBack={() => {}} />
);

export const FreeTextQuestion = () => (
  <QuestionFlow questions={QUESTIONS.slice(4)} onComplete={() => {}} onBack={() => {}} />
);

export const Generating = () => (
  <QuestionFlow questions={QUESTIONS} onComplete={() => {}} onBack={() => {}} pending />
);
