# Blockwright Studio plugin

Links a place open in Roblox Studio to a Blockwright project, so generated
scripts appear as real Instances instead of something you copy and paste.

## Install

1. Download `Blockwright.server.lua` from this folder.
2. Drop it into your local Roblox plugins folder:
   - **Windows** — `%LOCALAPPDATA%\Roblox\Plugins`
   - **macOS** — `~/Documents/Roblox/Plugins`
3. Restart Studio. A **Blockwright** button appears in the Plugins tab.

> Studio plugins are allowed to make outbound HTTP requests without enabling
> `HttpService` for the game — that setting governs your game servers, not the
> editor.

## Connect

1. Open a project in Blockwright and click **Connect Roblox Studio** in the
   Studio panel.
2. Copy the six-character code.
3. Open the plugin in Studio, paste the code, press **Connect**.

The plugin exchanges the code for a long-lived token stored in Studio's plugin
settings, so it reconnects on its own next time you open the place.

If you are running Blockwright somewhere other than `http://localhost:3000`,
change the server URL in the box at the bottom of the plugin panel.

## What it does

| Action             | Effect in Studio                                                |
| ------------------ | --------------------------------------------------------------- |
| `sync_files`       | Writes each script into a `Blockwright` folder under its service |
| `inspect_place`    | Reports the managed instances back to the conversation           |
| `create_folder`    | Creates a folder under a service                                 |
| `remove_instance`  | Deletes one managed instance                                     |

Everything generated lands inside a folder named `Blockwright` within the
relevant service, so it never mixes with instances you placed by hand.

## Security notes

- The plugin only ever executes an **allowlisted verb**. It cannot be sent code
  to run — a command is a name plus data, never a script.
- The token is scoped to a single project and can be revoked from the web app
  at any time (**Disconnect** in the Studio panel).
- Class names are checked against an allowlist before any Instance is created.
- Service names are resolved from a fixed table, so a malformed command cannot
  reach an arbitrary part of the DataModel.

## Troubleshooting

**"HTTP 401"** — the session was revoked from the web app. Disconnect in the
plugin and pair again with a fresh code.

**"That pairing code is not valid"** — codes expire after 10 minutes. Generate a
new one from the Studio panel.

**Nothing appears after a sync** — check that the plugin shows *Connected*, then
use **Sync all files** in the web app's Studio panel to push the whole project.
