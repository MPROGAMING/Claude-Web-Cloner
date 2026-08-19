import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from "blockwright";

// Previews are captured offline, so a remote portrait would 404 and silently
// fall back to initials. An inline data: URI always resolves.
const face = (bg: string, ink: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="${bg}"/>` +
      `<circle cx="32" cy="25" r="11" fill="${ink}"/>` +
      `<path d="M32 40c-12 0-20 8-22 24h44c-2-16-10-24-22-24z" fill="${ink}"/>` +
      `</svg>`,
  );

export const Sizes = () => (
  <div className="flex items-center gap-4">
    <Avatar size="sm">
      <AvatarFallback>MB</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>MB</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>MB</AvatarFallback>
    </Avatar>
  </div>
);

export const WithImage = () => (
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

export const WithBadge = () => (
  <div className="flex items-center gap-4">
    <Avatar>
      <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>DK</AvatarFallback>
      <AvatarBadge className="bg-signal" />
    </Avatar>
    <Avatar size="lg">
      <AvatarImage src={face("rgb(178,96,84)", "rgb(38,26,24)")} alt="Priya" />
      <AvatarFallback>PR</AvatarFallback>
      <AvatarBadge className="bg-muted-foreground/50" />
    </Avatar>
  </div>
);

export const Collaborators = () => (
  <div className="flex max-w-sm flex-col gap-3">
    <p className="text-xs text-muted-foreground">
      Bloxburg Tycoon — 5 collaborators
    </p>
    <AvatarGroup>
      <Avatar>
        <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
        <AvatarFallback>MB</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src={face("rgb(96,164,190)", "rgb(24,36,42)")} alt="Devan" />
        <AvatarFallback>DK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>PR</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+2</AvatarGroupCount>
    </AvatarGroup>
  </div>
);
