import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
} from "blockwright";
import { Check } from "lucide-react";

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
  <div className="flex items-center gap-5">
    <Avatar size="sm">
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
    <Avatar>
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
  </div>
);

export const Tones = () => (
  <div className="flex items-center gap-6">
    <div className="flex flex-col items-center gap-2">
      <Avatar size="lg">
        <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
        <AvatarFallback>MB</AvatarFallback>
        <AvatarBadge className="bg-success" />
      </Avatar>
      <span className="text-xs text-muted-foreground">online</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Avatar size="lg">
        <AvatarImage src={face("rgb(96,164,190)", "rgb(24,36,42)")} alt="Devan" />
        <AvatarFallback>DK</AvatarFallback>
        <AvatarBadge className="bg-signal" />
      </Avatar>
      <span className="text-xs text-muted-foreground">in Studio</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Avatar size="lg">
        <AvatarFallback>PR</AvatarFallback>
        <AvatarBadge className="bg-muted-foreground/50" />
      </Avatar>
      <span className="text-xs text-muted-foreground">away</span>
    </div>
  </div>
);

export const WithGlyph = () => (
  <div className="flex items-center gap-5">
    <Avatar size="lg">
      <AvatarImage src={face("rgb(108,150,96)", "rgb(26,34,24)")} alt="Priya" />
      <AvatarFallback>PR</AvatarFallback>
      <AvatarBadge className="bg-success">
        <Check />
      </AvatarBadge>
    </Avatar>
    <Avatar>
      <AvatarFallback>DK</AvatarFallback>
      <AvatarBadge className="bg-success">
        <Check />
      </AvatarBadge>
    </Avatar>
  </div>
);

export const InAGroup = () => (
  <AvatarGroup>
    <Avatar>
      <AvatarImage src={face("rgb(214,122,52)", "rgb(38,32,26)")} alt="Mara" />
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
    <Avatar>
      <AvatarImage src={face("rgb(96,164,190)", "rgb(24,36,42)")} alt="Devan" />
      <AvatarFallback>DK</AvatarFallback>
      <AvatarBadge className="bg-signal" />
    </Avatar>
    <Avatar>
      <AvatarFallback>PR</AvatarFallback>
      <AvatarBadge className="bg-muted-foreground/50" />
    </Avatar>
  </AvatarGroup>
);
