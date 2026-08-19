import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from "blockwright";
import { MessageSquare, Code2, Blocks } from "lucide-react";

export const Default = () => (
  <Tabs defaultValue="chat" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="chat">Chat</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
      <TabsTrigger value="blueprint">Blueprint</TabsTrigger>
    </TabsList>
    <TabsContent value="chat">
      <p className="text-sm text-muted-foreground">
        The filled list sits on a muted plate; the active tab lifts out of it.
      </p>
    </TabsContent>
    <TabsContent value="code">
      <p className="text-sm text-muted-foreground">14 scripts.</p>
    </TabsContent>
    <TabsContent value="blueprint">
      <p className="text-sm text-muted-foreground">Draft blueprint.</p>
    </TabsContent>
  </Tabs>
);

export const Line = () => (
  <Tabs defaultValue="builds" className="max-w-lg">
    <TabsList variant="line">
      <TabsTrigger value="builds">Builds</TabsTrigger>
      <TabsTrigger value="everything">Everything</TabsTrigger>
    </TabsList>
    <TabsContent value="builds">
      <p className="text-sm text-muted-foreground">
        The line list drops the plate and marks the active tab with a rule
        underneath it.
      </p>
    </TabsContent>
    <TabsContent value="everything">
      <p className="text-sm text-muted-foreground">42 events this week.</p>
    </TabsContent>
  </Tabs>
);

export const Vertical = () => (
  <Tabs orientation="vertical" defaultValue="code" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="code">
        <Code2 />
        Code
      </TabsTrigger>
      <TabsTrigger value="chat">
        <MessageSquare />
        Chat
      </TabsTrigger>
      <TabsTrigger value="blueprint">
        <Blocks />
        Blueprint
      </TabsTrigger>
    </TabsList>
    <TabsContent value="code">
      <p className="text-sm text-muted-foreground">
        A vertical list stacks full-width triggers and the root turns into a row.
      </p>
    </TabsContent>
    <TabsContent value="chat">
      <p className="text-sm text-muted-foreground">18 messages.</p>
    </TabsContent>
    <TabsContent value="blueprint">
      <p className="text-sm text-muted-foreground">Draft blueprint.</p>
    </TabsContent>
  </Tabs>
);

export const FullWidth = () => (
  <Tabs defaultValue="active" className="max-w-lg">
    <TabsList className="w-full">
      <TabsTrigger value="active">
        Active
        <Badge variant="secondary">4</Badge>
      </TabsTrigger>
      <TabsTrigger value="archived">
        Archived
        <Badge variant="secondary">2</Badge>
      </TabsTrigger>
    </TabsList>
    <TabsContent value="active">
      <p className="text-sm text-muted-foreground">
        Bloxburg Tycoon, Obby Checkpoints, Sword Fight Arena, Shop Kiosk
      </p>
    </TabsContent>
    <TabsContent value="archived">
      <p className="text-sm text-muted-foreground">
        Tycoon Prototype, Racing Test
      </p>
    </TabsContent>
  </Tabs>
);
