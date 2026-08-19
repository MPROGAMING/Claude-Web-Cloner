import { BlueprintDialog, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "blockwright";
import { Map as MapIcon, Sparkles } from "lucide-react";

// BlueprintDialog owns its open state internally and exposes no defaultOpen, so
// a static capture can only ever show the trigger — the dialog opens on click and
// every stage past "idea" is backed by a real request to /api/blueprint, which an
// offline capture cannot serve either. These cells therefore show the trigger in
// the places it actually appears. The flow's interior is covered by the
// QuestionFlow and BlueprintView cards, which render their stages directly.
export const DefaultTrigger = () => (
  <BlueprintDialog projectId="proj_bloxburg" projectName="Bloxburg Tycoon" />
);

export const CustomTrigger = () => (
  <BlueprintDialog
    projectId="proj_bloxburg"
    projectName="Bloxburg Tycoon"
    trigger={
      <Button variant="outline" size="sm">
        <MapIcon data-icon="inline-start" />
        Plan this game
      </Button>
    }
  />
);

export const SeededFromAnIdea = () => (
  <BlueprintDialog
    projectId="proj_crystal"
    projectName="Crystal Islands"
    seedIdea="A collect-and-sell simulator where islands drift apart as you mine them"
    trigger={
      <Button size="sm">
        <Sparkles data-icon="inline-start" />
        Continue planning
      </Button>
    }
  />
);

export const OnAProjectCard = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Obby Checkpoints</CardTitle>
      <CardDescription>No blueprint yet</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Plan the mechanic before anything is written, so you approve the decisions
        rather than the code.
      </p>
      <BlueprintDialog
        projectId="proj_obby"
        projectName="Obby Checkpoints"
        trigger={
          <Button variant="outline" size="sm" className="self-start">
            <MapIcon data-icon="inline-start" />
            Plan this game
          </Button>
        }
      />
    </CardContent>
  </Card>
);
