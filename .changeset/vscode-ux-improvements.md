---
"porthawk-core": patch
"porthawk": patch
"porthawk-vscode": patch
---

Add several UI/UX improvements: click a port row to open it in the browser directly, copy port/PID from the context menu, kill every process in a group at once, ignore a process so it stops showing up (with a command to undo), a quick command to toggle hiding system processes, and a "Refreshing…"/empty-state message in the sidebar so it's clear what's happening instead of looking blank. Also add a `--json` flag to `porthawk list` for scripting.
