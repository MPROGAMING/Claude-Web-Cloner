import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  Badge,
} from "blockwright";

const face = (bg: string, ink: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="${bg}"/>` +
      `<circle cx="32" cy="25" r="11" fill="${ink}"/>` +
      `<path d="M32 40c-12 0-20 8-22 24h44c-2-16-10-24-22-24z" fill="${ink}"/>` +
      `</svg>`,
  );

const TEAM = [
  { initials: "MB", src: face("rgb(214,122,52)", "rgb(38,32,26)"), name: "Mara" },
  { initials: "DK", src: face("rgb(96,164,190)", "rgb(24,36,42)"), name: "Devan" },
  { initials: "PR", src: face("rgb(108,150,96)", "rgb(26,34,24)"), name: "Priya" },
  { initials: "JT", src: face("rgb(178,96,84)", "rgb(38,26,24)"), name: "Jonah" },
];

export const Overlapping = () => (
  <AvatarGroup>
    {TEAM.map((m) => (
      <Avatar key={m.initials}>
        <AvatarImage src={m.src} alt={m.name} />
        <AvatarFallback>{m.initials}</AvatarFallback>
      </Avatar>
    ))}
  </AvatarGroup>
);

export const Sizes = () => (
  <div className="flex flex-col gap-4">
    <AvatarGroup>
      {TEAM.slice(0, 3).map((m) => (
        <Avatar key={m.initials} size="sm">
          <AvatarFallback>{m.initials}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
    <AvatarGroup>
      {TEAM.slice(0, 3).map((m) => (
        <Avatar key={m.initials}>
          <AvatarFallback>{m.initials}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
    <AvatarGroup>
      {TEAM.slice(0, 3).map((m) => (
        <Avatar key={m.initials} size="lg">
          <AvatarFallback>{m.initials}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
  </div>
);

export const WithPresence = () => (
  <AvatarGroup>
    <Avatar size="lg">
      <AvatarImage src={TEAM[0].src} alt="Mara" />
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
    <Avatar size="lg">
      <AvatarImage src={TEAM[1].src} alt="Devan" />
      <AvatarFallback>DK</AvatarFallback>
      <AvatarBadge className="bg-signal" />
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>PR</AvatarFallback>
      <AvatarBadge className="bg-muted-foreground/50" />
    </Avatar>
    <AvatarGroupCount>+3</AvatarGroupCount>
  </AvatarGroup>
);

export const InAProjectCard = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Sword Fight Arena</CardTitle>
      <CardDescription>7 collaborators · 14 scripts</CardDescription>
      <CardAction>
        <Badge variant="outline">Draft</Badge>
      </CardAction>
    </CardHeader>
    <CardContent className="flex items-center justify-between gap-3">
      <AvatarGroup>
        {TEAM.map((m) => (
          <Avatar key={m.initials} size="sm">
            <AvatarImage src={m.src} alt={m.name} />
            <AvatarFallback>{m.initials}</AvatarFallback>
          </Avatar>
        ))}
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
      <span className="font-mono text-xs text-muted-foreground">
        edited 4 min ago
      </span>
    </CardContent>
  </Card>
);
