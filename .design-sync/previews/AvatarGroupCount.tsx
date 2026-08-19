import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "blockwright";
import { Plus } from "lucide-react";

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
];

export const Overflow = () => (
  <AvatarGroup>
    {TEAM.map((m) => (
      <Avatar key={m.initials}>
        <AvatarImage src={m.src} alt={m.name} />
        <AvatarFallback>{m.initials}</AvatarFallback>
      </Avatar>
    ))}
    <AvatarGroupCount>+3</AvatarGroupCount>
  </AvatarGroup>
);

export const Sizes = () => (
  <div className="flex flex-col gap-4">
    <AvatarGroup>
      <Avatar size="sm">
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <Avatar size="sm">
        <AvatarFallback>DK</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+9</AvatarGroupCount>
    </AvatarGroup>
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>DK</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+9</AvatarGroupCount>
    </AvatarGroup>
    <AvatarGroup>
      <Avatar size="lg">
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>DK</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+9</AvatarGroupCount>
    </AvatarGroup>
  </div>
);

export const WithGlyph = () => (
  <AvatarGroup>
    {TEAM.map((m) => (
      <Avatar key={m.initials}>
        <AvatarImage src={m.src} alt={m.name} />
        <AvatarFallback>{m.initials}</AvatarFallback>
      </Avatar>
    ))}
    <AvatarGroupCount>
      <Plus />
    </AvatarGroupCount>
  </AvatarGroup>
);

export const InAProjectCard = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Obby Checkpoints</CardTitle>
      <CardDescription>6 collaborators can review change sets</CardDescription>
    </CardHeader>
    <CardContent>
      <AvatarGroup>
        {TEAM.map((m) => (
          <Avatar key={m.initials} size="sm">
            <AvatarImage src={m.src} alt={m.name} />
            <AvatarFallback>{m.initials}</AvatarFallback>
          </Avatar>
        ))}
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
    </CardContent>
  </Card>
);
