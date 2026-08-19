import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  Badge,
} from "blockwright";

// Inline data: URIs, because previews are captured with no network — a remote
// portrait would 404 and every image cell would silently show initials instead.
const face = (bg: string, ink: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="${bg}"/>` +
      `<circle cx="32" cy="25" r="11" fill="${ink}"/>` +
      `<path d="M32 40c-12 0-20 8-22 24h44c-2-16-10-24-22-24z" fill="${ink}"/>` +
      `</svg>`,
  );

export const Loaded = () => (
  <div className="flex items-center gap-4">
    <Avatar size="sm">
      <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
      <AvatarFallback>MB</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarImage src={face("rgb(96,164,190)", "rgb(24,36,42)")} alt="Devan" />
      <AvatarFallback>DK</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarImage src={face("rgb(108,150,96)", "rgb(26,34,24)")} alt="Priya" />
      <AvatarFallback>PR</AvatarFallback>
    </Avatar>
  </div>
);

export const FallsBackWhenBroken = () => (
  <div className="flex items-center gap-6">
    <div className="flex flex-col items-center gap-2">
      <Avatar size="lg">
        <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground">loaded</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Avatar size="lg">
        <AvatarImage src="" alt="Devan Kaur" />
        <AvatarFallback>DK</AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground">no src</span>
    </div>
  </div>
);

export const WithBadge = () => (
  <div className="flex items-center gap-4">
    <Avatar>
      <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
    <Avatar size="lg">
      <AvatarImage src={face("rgb(96,164,190)", "rgb(24,36,42)")} alt="Devan" />
      <AvatarFallback>DK</AvatarFallback>
      <AvatarBadge className="bg-signal" />
    </Avatar>
  </div>
);

export const InAProjectCard = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Bloxburg Tycoon</CardTitle>
      <CardDescription>Change set 0f3a · 3 files</CardDescription>
      <CardAction>
        <Badge variant="outline">Live</Badge>
      </CardAction>
    </CardHeader>
    <CardContent className="flex items-center gap-2.5">
      <Avatar size="sm">
        <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground">
        Mara approved this change set
      </span>
    </CardContent>
  </Card>
);
