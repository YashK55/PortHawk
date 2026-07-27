// The dashboard is a single inline HTML/CSS/JS document rather than a bundled
// framework app: it renders one table of a few dozen rows and needs no routing,
// component tree, or build step of its own. Keeping it inline also means the
// webview loads no local resources at all, so the panel can run with an empty
// localResourceRoots and a default-src 'none' CSP.
//
// All colors come from VS Code's own CSS variables so the panel tracks the
// active light/dark/high-contrast theme with no theme-detection code.
const dashboardStyles = `
  body {
    margin: 0;
    padding: 0;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
  }

  .toolbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 12px 16px;
    background: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
  }

  .toolbar label {
    color: var(--vscode-descriptionForeground);
  }

  #search {
    flex: 1 1 220px;
    min-width: 160px;
    padding: 4px 8px;
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    font-family: inherit;
    font-size: inherit;
  }

  #search::placeholder {
    color: var(--vscode-input-placeholderForeground);
  }

  #sort {
    padding: 4px 8px;
    color: var(--vscode-dropdown-foreground);
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border, transparent);
    border-radius: 2px;
    font-family: inherit;
    font-size: inherit;
  }

  #search:focus, #sort:focus, button:focus-visible, tr:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  #count {
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    position: sticky;
    top: 53px;
    text-align: left;
    padding: 6px 16px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
  }

  td {
    padding: 5px 16px;
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
  }

  tbody tr {
    cursor: pointer;
  }

  tbody tr:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .port {
    font-family: var(--vscode-editor-font-family);
    font-variant-numeric: tabular-nums;
  }

  .pid {
    font-variant-numeric: tabular-nums;
    color: var(--vscode-descriptionForeground);
  }

  .protocol {
    color: var(--vscode-descriptionForeground);
  }

  .badge {
    display: inline-block;
    padding: 0 6px;
    border: 1px solid currentColor;
    border-radius: 8px;
    font-size: 0.9em;
    line-height: 1.5;
  }

  .badge-agent { color: var(--vscode-charts-purple, var(--vscode-foreground)); }
  .badge-manual { color: var(--vscode-charts-blue, var(--vscode-foreground)); }
  .badge-unknown { color: var(--vscode-descriptionForeground); }

  .actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  button {
    padding: 2px 10px;
    border: 1px solid transparent;
    border-radius: 2px;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    color: var(--vscode-button-secondaryForeground);
    background: var(--vscode-button-secondaryBackground);
  }

  button:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }

  .kill {
    color: var(--vscode-errorForeground);
  }

  #empty {
    padding: 24px 16px;
    color: var(--vscode-descriptionForeground);
  }

  [hidden] {
    display: none !important;
  }
`;

// Written without template literals so the outer template literal in
// renderDashboardHtml() doesn't try to interpolate anything here.
const dashboardScript = `
  (function () {
    const vscode = acquireVsCodeApi();

    const search = document.getElementById('search');
    const sort = document.getElementById('sort');
    const tbody = document.getElementById('rows');
    const empty = document.getElementById('empty');
    const count = document.getElementById('count');

    let allPorts = [];
    const renderedRows = new Map();

    const saved = vscode.getState();
    if (saved) {
      search.value = saved.search || '';
      sort.value = saved.sort || 'port';
    }

    function rowId(port) {
      return port.pid + ':' + port.port + ':' + port.protocol;
    }

    function processLabel(port) {
      return port.processName || 'unknown';
    }

    function matchingSortedPorts() {
      const query = search.value.trim().toLowerCase();
      const matched = query
        ? allPorts.filter(function (port) {
            return processLabel(port).toLowerCase().indexOf(query) !== -1 || String(port.port).indexOf(query) !== -1;
          })
        : allPorts.slice();

      const mode = sort.value;
      return matched.sort(function (a, b) {
        if (mode === 'process') {
          return processLabel(a).localeCompare(processLabel(b)) || a.port - b.port;
        }
        if (mode === 'origin') {
          return a.origin.localeCompare(b.origin) || a.port - b.port;
        }
        return a.port - b.port;
      });
    }

    function setText(node, text) {
      if (node.textContent !== text) {
        node.textContent = text;
      }
    }

    function createRow(port) {
      const tr = document.createElement('tr');
      tr.dataset.id = rowId(port);
      tr.tabIndex = 0;

      const cells = {
        port: document.createElement('td'),
        process: document.createElement('td'),
        pid: document.createElement('td'),
        protocol: document.createElement('td'),
        origin: document.createElement('td'),
        actions: document.createElement('td'),
      };

      cells.port.className = 'port';
      cells.pid.className = 'pid';
      cells.protocol.className = 'protocol';

      const badge = document.createElement('span');
      cells.origin.appendChild(badge);

      const openButton = document.createElement('button');
      openButton.dataset.action = 'open';
      openButton.textContent = 'Open';
      const killButton = document.createElement('button');
      killButton.dataset.action = 'kill';
      killButton.className = 'kill';
      killButton.textContent = 'Kill';

      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.appendChild(openButton);
      actions.appendChild(killButton);
      cells.actions.appendChild(actions);

      tr.appendChild(cells.port);
      tr.appendChild(cells.process);
      tr.appendChild(cells.pid);
      tr.appendChild(cells.protocol);
      tr.appendChild(cells.origin);
      tr.appendChild(cells.actions);

      const entry = { el: tr, cells: cells, badge: badge, openButton: openButton, killButton: killButton };
      updateRow(entry, port);
      return entry;
    }

    function updateRow(entry, port) {
      setText(entry.cells.port, ':' + port.port);
      setText(entry.cells.process, processLabel(port));
      setText(entry.cells.pid, String(port.pid));
      setText(entry.cells.protocol, port.protocol.toUpperCase());
      setText(entry.badge, port.origin);

      const badgeClass = 'badge badge-' + port.origin;
      if (entry.badge.className !== badgeClass) {
        entry.badge.className = badgeClass;
      }

      const tooltip = port.command || processLabel(port);
      if (entry.el.title !== tooltip) {
        entry.el.title = tooltip;
      }

      const openLabel = 'Open localhost:' + port.port + ' in browser';
      if (entry.openButton.title !== openLabel) {
        entry.openButton.title = openLabel;
      }
      const killLabel = 'Kill ' + processLabel(port) + ' (PID ' + port.pid + ')';
      if (entry.killButton.title !== killLabel) {
        entry.killButton.title = killLabel;
      }
    }

    // Reconciles the existing rows in place instead of rebuilding tbody, so an
    // unchanged row keeps its DOM node (and the page keeps scroll position,
    // focus, and text selection) across a refresh.
    function render() {
      const ports = matchingSortedPorts();
      const seen = new Set();
      let previous = null;

      for (const port of ports) {
        const id = rowId(port);
        seen.add(id);

        let entry = renderedRows.get(id);
        if (entry) {
          updateRow(entry, port);
        } else {
          entry = createRow(port);
          renderedRows.set(id, entry);
        }

        const expected = previous ? previous.nextSibling : tbody.firstChild;
        if (entry.el !== expected) {
          tbody.insertBefore(entry.el, expected);
        }
        previous = entry.el;
      }

      for (const [id, entry] of renderedRows) {
        if (!seen.has(id)) {
          entry.el.remove();
          renderedRows.delete(id);
        }
      }

      if (allPorts.length === 0) {
        setText(empty, 'No listening ports found.');
        empty.hidden = false;
      } else if (ports.length === 0) {
        setText(empty, 'No ports match this filter.');
        empty.hidden = false;
      } else {
        empty.hidden = true;
      }

      const total = allPorts.length + (allPorts.length === 1 ? ' port' : ' ports');
      setText(count, ports.length === allPorts.length ? total : ports.length + ' of ' + total);
    }

    function persistControls() {
      vscode.setState({ search: search.value, sort: sort.value });
      render();
    }

    search.addEventListener('input', persistControls);
    sort.addEventListener('change', persistControls);

    tbody.addEventListener('click', function (event) {
      const row = event.target.closest('tr');
      if (!row) {
        return;
      }
      const button = event.target.closest('button');
      vscode.postMessage({ type: button ? button.dataset.action : 'open', id: row.dataset.id });
    });

    tbody.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') {
        return;
      }
      const row = event.target.closest('tr');
      if (row) {
        vscode.postMessage({ type: 'open', id: row.dataset.id });
      }
    });

    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'ports') {
        allPorts = event.data.ports;
        render();
      }
    });

    render();
    vscode.postMessage({ type: 'ready' });
  })();
`;

export function renderDashboardHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>PortHawk Dashboard</title>
<style nonce="${nonce}">${dashboardStyles}</style>
</head>
<body>
<div class="toolbar">
  <label for="search">Filter</label>
  <input id="search" type="search" placeholder="Process name or port number" autocomplete="off">
  <label for="sort">Sort by</label>
  <select id="sort">
    <option value="port">Port</option>
    <option value="process">Process name</option>
    <option value="origin">Origin</option>
  </select>
  <span id="count"></span>
</div>
<table>
  <thead>
    <tr>
      <th scope="col">Port</th>
      <th scope="col">Process</th>
      <th scope="col">PID</th>
      <th scope="col">Protocol</th>
      <th scope="col">Origin</th>
      <th scope="col"><span class="actions">Actions</span></th>
    </tr>
  </thead>
  <tbody id="rows"></tbody>
</table>
<div id="empty" hidden></div>
<script nonce="${nonce}">${dashboardScript}</script>
</body>
</html>`;
}
