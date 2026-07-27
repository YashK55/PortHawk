# PortHawk

See every port your machine is listening on, know which ones a coding agent left behind, and kill the ones that shouldn't still be running.

[![npm version](https://img.shields.io/npm/v/porthawk.svg)](https://www.npmjs.com/package/porthawk)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/YashK55.porthawk-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=YashK55.porthawk-vscode)
[![Open VSX](https://img.shields.io/open-vsx/v/YashK55/porthawk-vscode.svg)](https://open-vsx.org/extension/YashK55/porthawk-vscode)
[![CI](https://github.com/YashK55/PortHawk/actions/workflows/test.yml/badge.svg)](https://github.com/YashK55/PortHawk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why

AI coding agents — Claude Code, Cursor, and others — spin up dev servers in your terminal constantly, and it's easy to lose track of which ones are still running long after you've moved on. A leftover `node`, `python`, or `next dev` process quietly holding onto a port isn't dangerous, but it's clutter, and eventually it collides with something you're trying to start fresh.

The obvious fix is a port-monitor extension, but most of the existing ones are closed-source: you're installing something with filesystem and process access and just trusting that it's not phoning home. PortHawk is a small, open-source, telemetry-free alternative — you can read every line of what it does, because there isn't much of it.

It also does one thing generic port listers don't: it tags each listening port as `agent`, `manual`, or `unknown` based on whether the process traces back to a known coding-agent or editor terminal, so the orphaned ones actually stand out.

## Install

### VS Code Marketplace

Search for **PortHawk** in the Extensions view, or install directly:

```
ext install YashK55.porthawk-vscode
```

Or from the command line:

```
code --install-extension YashK55.porthawk-vscode
```

### Open VSX (Cursor, Windsurf, VSCodium, and other forks)

VS Code forks that use Open VSX instead of the Microsoft Marketplace can install the same extension from [open-vsx.org/extension/YashK55/porthawk-vscode](https://open-vsx.org/extension/YashK55/porthawk-vscode), or search **PortHawk** directly in the Extensions view of Cursor, Windsurf, or VSCodium.

> Note: vscode.dev and github.dev aren't supported — browser-based VS Code has no process or filesystem access, so there's nothing for PortHawk to detect there.

### CLI (npx)

No install needed:

```
npx porthawk list
```

Or install it globally:

```
npm install -g porthawk
porthawk watch
```

## Features

- **Cross-platform port detection** — Windows, macOS, and Linux, with native OS commands as a fallback if the primary detection method comes up empty.
- **Agent-aware classification** — every listening port is tagged `agent`, `manual`, or `unknown` depending on whether its process traces back to a known coding-agent or editor terminal, not just a generic PID list.
- **VS Code sidebar + dashboard + status bar** — a dedicated Activity Bar view that toggles between grouping by process and a flat list sorted by port, a filterable/sortable dashboard panel, and a live status bar count, all native to your editor's theme.
- **Keyboard-first** — `Ctrl+Alt+P` / `Cmd+Alt+P` opens the dashboard from anywhere; `Ctrl+Alt+R` refreshes and `Ctrl+Alt+K` kills the selected port while the PortHawk view is focused. Every action is also in the command palette under `PortHawk:`.
- **`porthawk watch`** — a live, keyboard-driven terminal UI (arrow keys to select, `k` to kill, `q` to quit), not just a static table.
- **Confirmation before every kill** — in both the CLI and the extension, so nothing gets terminated on a stray keypress or click.
- **No telemetry, ever, by default** — nothing phones home. If usage analytics are ever added, they'll be opt-in and clearly disclosed.
- **Works in any Open VSX–based fork** — Cursor, Windsurf, VSCodium, Trae — not just VS Code itself.

## How it compares

|                                   | PortHawk | Typical closed-source port-monitor extension |
| --------------------------------- | :------: | :--------------------------------------------: |
| Source available to read          |    ✅    |                        ❌                        |
| Telemetry disclosed (or absent)   |    ✅    |                    Often unclear                 |
| Tags agent-spawned vs manual ports |    ✅    |                        ❌                        |
| Works outside VS Code (CLI)       |    ✅    |                        ❌                        |
| Works in Open VSX forks           |    ✅    |                    Varies                       |

This isn't a claim that every alternative is malicious — most probably aren't. It's that with PortHawk you don't have to take that on faith.

## Contributing

Issues and pull requests are welcome. This is a pnpm workspace with three packages — `packages/core` (detection/kill engine), `packages/cli`, and `packages/vscode-ext` — sharing one `core` dependency.

```
pnpm install
pnpm run build
pnpm run test
```

Please open an issue before a large change so the direction can be agreed on first.

## License

MIT — see [LICENSE](LICENSE).
