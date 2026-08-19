import { Button, Label, Textarea } from "blockwright";

// Textarea has no in-app caller yet; these mirror the shape the forms already
// use for Input (Label above, hint below) and the one long-text field the
// product actually asks for — the project description / prompt.
const Field = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-md space-y-1.5">{children}</div>
);

export const Placeholder = () => (
  <Field>
    <Label htmlFor="idea">What are we building?</Label>
    <Textarea
      id="idea"
      rows={4}
      placeholder="A round-based zombie survival where players hold out in a barricaded house, earn cash for kills, and buy weapons between waves."
    />
  </Field>
);

export const Filled = () => (
  <Field>
    <Label htmlFor="description">Description</Label>
    <Textarea
      id="description"
      rows={4}
      defaultValue={
        "A collect-and-sell tycoon. Droppers feed a conveyor, the conveyor feeds a furnace, and the furnace pays cash into a leaderstats value. Players buy upgrades from a shop GUI."
      }
    />
    <p className="text-xs text-muted-foreground">
      Blockwright seeds your first prompt from this.
    </p>
  </Field>
);

export const Disabled = () => (
  <Field>
    <Label htmlFor="archived-notes">Change set summary</Label>
    <Textarea
      id="archived-notes"
      rows={3}
      defaultValue={
        "Added RoundTimer.server.luau to ServerScriptService and a RoundState remote to ReplicatedStorage."
      }
      disabled
    />
    <p className="text-xs text-muted-foreground">
      Applied change sets are read-only.
    </p>
  </Field>
);

// aria-invalid is what paints the destructive border — the Textarea validates
// nothing itself, so the calling form sets it alongside the message.
export const Invalid = () => (
  <Field>
    <Label htmlFor="invalid-idea">What are we building?</Label>
    <Textarea id="invalid-idea" rows={3} defaultValue="a game" aria-invalid />
    <p className="text-xs text-destructive">
      Describe the mechanic in a sentence or two so the plan has something to
      work from.
    </p>
  </Field>
);

export const InProjectSettings = () => (
  <div className="max-w-xl rounded-xl border border-border bg-surface p-6">
    <h2 className="text-sm font-semibold">About this project</h2>
    <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
      Replayed to the model on every turn, so keep it about the game.
    </p>

    <div className="mt-5 space-y-1.5">
      <Label htmlFor="about-description">Description</Label>
      <Textarea
        id="about-description"
        rows={4}
        defaultValue={
          "Obby with 12 checkpoint stages. Touching a checkpoint part saves the player's spawn; dying respawns them at the last one touched instead of the lobby."
        }
      />
    </div>

    <div className="mt-6 flex justify-end border-t border-hairline pt-5">
      <Button type="submit">Save changes</Button>
    </div>
  </div>
);
