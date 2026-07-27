---
'porthawk-vscode': minor
---

Add a dashboard panel and tie the extension's navigation together.

- New "PortHawk: Open Dashboard" command opens a webview panel showing every listening port in a filterable, sortable table, with per-origin badges and kill/open buttons on each row. It matches the active colour theme and applies the same filters as the sidebar.
- The sidebar tree can now toggle between grouping by process and a flat list sorted by port number, from a button in the view's title bar. The choice is remembered per workspace.
- Empty states are now welcome views with buttons rather than a plain message, so "nothing is listening" and "everything is hidden by your filters" both offer a way forward.
- The status bar item now opens the dashboard when clicked.
- Added keyboard shortcuts: `Ctrl+Alt+P` / `Cmd+Alt+P` opens the dashboard, and `Ctrl+Alt+R` / `Ctrl+Alt+K` refresh and kill the selected port while the PortHawk view is focused.
- Fixed the sidebar flickering on every refresh. The tree now only re-renders when the port data has actually changed, and the in-progress indicator no longer shifts the rows.
