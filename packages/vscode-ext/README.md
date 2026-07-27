# PortHawk

See every port your machine is listening on, know which ones a coding agent left behind, and kill the ones that shouldn't still be running.

## Why

AI coding agents spin up dev servers constantly, and it's easy to lose track of which ones are still running long after you've moved on. PortHawk shows every listening port in a sidebar, tags it as `agent`-spawned, `manual`, or `unknown` based on whether the process traces back to a known editor or agent terminal, and lets you kill a stale one with a confirmation click.

It's open source and has no telemetry, by default or otherwise.

## Features

- Activity Bar view, each row showing the port, process, protocol, and PID, with an icon marking `agent` vs `manual` vs `unknown` origin
- Toggle the tree between **grouped by process** and a **flat list sorted by port** from the view's title bar — your choice is remembered per workspace
- A **dashboard** panel showing the same ports in a filterable, sortable table, with per-origin badges and kill/open buttons on every row
- Status bar item with a live count — click it to open the dashboard
- Kill a process from the tree, the dashboard, or the command palette, always with a confirmation prompt first
- Open a port directly in your browser
- Auto-refreshes while the view or dashboard is visible, and stops polling when neither is, so it doesn't run in the background for no reason
- Settings for refresh interval, whether to tag agent-spawned processes, and whether to notify on a new orphaned server

## Keyboard shortcuts

| Shortcut | Action | Active when |
| --- | --- | --- |
| `Ctrl+Alt+P` / `Cmd+Alt+P` | Open Dashboard | Anywhere |
| `Ctrl+Alt+R` / `Cmd+Alt+R` | Refresh | The PortHawk view or dashboard is focused |
| `Ctrl+Alt+K` / `Cmd+Alt+K` | Kill the selected port's process | The PortHawk view is focused |

Killing always asks for confirmation first, so the shortcut can't terminate anything on its own. Every action is also available from the command palette under the `PortHawk:` prefix, and all three shortcuts can be remapped from **Keyboard Shortcuts** if they clash with your setup.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `porthawk.refreshInterval` | `3000` | How often to re-scan listening ports, in milliseconds, while the view is visible. |
| `porthawk.autoTagAgentProcesses` | `true` | Tag ports likely opened by a coding agent's terminal with a distinct icon. |
| `porthawk.notifyOnNewOrphanedServer` | `false` | Show a notification when a new likely agent-spawned server is detected. |
| `porthawk.hideSystemProcesses` | `true` | Hide well-known OS/service processes from the list. Detection itself is unaffected — the CLI always shows everything. |
| `porthawk.ignoredProcessNames` | `[]` | Process names to always hide, managed by the "Ignore Process" command. |

## Not supported

vscode.dev and github.dev aren't supported — browser-based VS Code has no process or filesystem access, so there's nothing here for PortHawk to detect.

## Also available as a CLI

```
npx porthawk list
npx porthawk watch
```

Source, issues, and the standalone CLI: [github.com/YashK55/PortHawk](https://github.com/YashK55/PortHawk)

## License

MIT
