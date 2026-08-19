import {
  Avatar,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "blockwright";
import { Users } from "lucide-react";

export const Initials = () => (
  <div className="flex items-center gap-4">
    <Avatar size="sm">
      <AvatarFallback>MB</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>DK</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>PR</AvatarFallback>
    </Avatar>
  </div>
);

export const Tinted = () => (
  <div className="flex items-center gap-4">
    <Avatar size="lg">
      <AvatarFallback className="bg-ember/20 text-ember">MB</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback className="bg-signal/20 text-signal">DK</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback className="bg-success/20 text-success-ink">
        PR
      </AvatarFallback>
    </Avatar>
  </div>
);

export const WithIcon = () => (
  <div className="flex items-center gap-4">
    <Avatar>
      <AvatarFallback>
        <Users className="size-4" />
      </AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>
        <Users className="size-5" />
      </AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>MB</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
  </div>
);

export const InAMemberList = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Bloxburg Tycoon</CardTitle>
      <CardDescription>Collaborators</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      {[
        { initials: "MB", name: "Mara Bell", role: "Owner" },
        { initials: "DK", name: "Devan Kaur", role: "Can edit scripts" },
        { initials: "PR", name: "Priya Rao", role: "Can review change sets" },
      ].map((m) => (
        <div key={m.initials} className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback>{m.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{m.name}</p>
            <p className="truncate text-xs text-muted-foreground">{m.role}</p>
          </div>
        </div>
      ))}
      <AvatarGroup>
        <Avatar size="sm">
          <AvatarFallback>MB</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback>DK</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback>PR</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>
    </CardContent>
  </Card>
);
