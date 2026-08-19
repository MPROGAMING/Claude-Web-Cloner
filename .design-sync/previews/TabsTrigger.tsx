import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from "blockwright";
import { MessageSquare, Code2, Blocks } from "lucide-react";

export const SelectedAndRest = () => (
  <Tabs defaultValue="code" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="chat">Chat</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
      <TabsTrigger value="blueprint">Blueprint</TabsTrigger>
    </TabsList>
    <TabsContent value="chat">
      <p className="text-sm text-muted-foreground">18 messages.</p>
    </TabsContent>
    <TabsContent value="code">
      <p className="text-sm text-muted-foreground">
        Code is selected — it takes the foreground ink and the raised plate,
        while the others stay at 60%.
      </p>
    </TabsContent>
    <TabsContent value="blueprint">
      <p className="text-sm text-muted-foreground">Draft blueprint.</p>
    </TabsContent>
  </Tabs>
);

export const WithIcons = () => (
  <Tabs defaultValue="chat" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="chat">
        <MessageSquare />
        Chat
      </TabsTrigger>
      <TabsTrigger value="code">
        <Code2 />
        Code
      </TabsTrigger>
      <TabsTrigger value="blueprint">
        <Blocks />
        Blueprint
      </TabsTrigger>
    </TabsList>
    <TabsContent value="chat">
      <p className="text-sm text-muted-foreground">
        Icons inside a trigger size themselves to 16px.
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

export const WithCounts = () => (
  <Tabs defaultValue="builds" className="max-w-lg">
    <TabsList variant="line">
      <TabsTrigger value="builds">
        Builds
        <Badge variant="secondary">7</Badge>
      </TabsTrigger>
      <TabsTrigger value="everything">
        Everything
        <Badge variant="secondary">42</Badge>
      </TabsTrigger>
    </TabsList>
    <TabsContent value="builds">
      <p className="text-sm text-muted-foreground">
        Seven builds ran against Bloxburg Tycoon this week.
      </p>
    </TabsContent>
    <TabsContent value="everything">
      <p className="text-sm text-muted-foreground">42 events.</p>
    </TabsContent>
  </Tabs>
);

export const Disabled = () => (
  <Tabs defaultValue="code" className="max-w-lg">
    <TabsList>
      <TabsTrigger value="chat">Chat</TabsTrigger>
      <TabsTrigger value="code">Code</TabsTrigger>
      <TabsTrigger value="studio" disabled>
        Studio
      </TabsTrigger>
    </TabsList>
    <TabsContent value="chat">
      <p className="text-sm text-muted-foreground">18 messages.</p>
    </TabsContent>
    <TabsContent value="code">
      <p className="text-sm text-muted-foreground">
        Studio is disabled until the plugin pairs — it drops to 50% and stops
        taking the pointer.
      </p>
    </TabsContent>
    <TabsContent value="studio">
      <p className="text-sm text-muted-foreground">Not paired.</p>
    </TabsContent>
  </Tabs>
);
