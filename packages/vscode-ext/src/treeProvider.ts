import * as vscode from 'vscode';
import { isSystemProcess, type Origin, type PortInfo } from 'porthawk-core';
import { portId, portsEqual } from './portDiff.js';

// 'unknown' deliberately doesn't use the 'question' codicon — it renders as a
// literal "?" glyph, which reads as a missing/placeholder icon rather than a
// deliberate origin tag. 'circle-outline' matches the neutral icon already
// used when origin tagging is turned off entirely.
const originIconId: Record<Origin, string> = {
  agent: 'circuit-board',
  manual: 'person',
  unknown: 'circle-outline',
};

// Same array-of-patterns shape as core's classify.ts rules — easy to extend,
// first match wins, falls back to a generic process icon.
const groupIconRules: Array<{ pattern: RegExp; icon: string }> = [
  { pattern: /^(chrome|msedge|firefox|brave|safari)(\.exe)?$/i, icon: 'globe' },
  { pattern: /^(nginx|httpd|apache2?|caddy)(\.exe)?$/i, icon: 'globe' },
  { pattern: /^(postgres|postgresql|mysqld|mongod|redis-server|redis)(\.exe)?$/i, icon: 'database' },
  { pattern: /^(docker|com\.docker\.backend|dockerd|containerd)(\.exe)?$/i, icon: 'vm' },
  { pattern: /^(node|deno|bun)(\.exe)?$/i, icon: 'symbol-event' },
  { pattern: /^(python3?|py)(\.exe)?$/i, icon: 'symbol-misc' },
  { pattern: /^(java|javaw)(\.exe)?$/i, icon: 'symbol-class' },
  { pattern: /^(ruby|rails)(\.exe)?$/i, icon: 'ruby' },
  { pattern: /^(code|code-oss|cursor|windsurf)(\.exe)?$/i, icon: 'window' },
];

function iconIdForProcess(processName: string): string {
  for (const rule of groupIconRules) {
    if (rule.pattern.test(processName)) {
      return rule.icon;
    }
  }
  return 'server-process';
}

export class ProcessGroupItem extends vscode.TreeItem {
  constructor(
    public readonly processName: string,
    public readonly ports: PortInfo[],
  ) {
    super(processName, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `group:${processName}`;
    this.iconPath = new vscode.ThemeIcon(iconIdForProcess(processName));
    this.description = `${ports.length} port${ports.length === 1 ? '' : 's'}`;
    this.contextValue = 'portGroup';
  }
}

export class PortEntryItem extends vscode.TreeItem {
  constructor(
    public readonly port: PortInfo,
    tagOrigin: boolean,
  ) {
    super(`:${port.port}`, vscode.TreeItemCollapsibleState.None);
    this.id = `port:${portId(port)}`;
    this.description = `${port.processName || 'unknown'} · ${port.protocol.toUpperCase()} · PID ${port.pid}`;
    this.tooltip = port.command || port.processName;
    this.iconPath = new vscode.ThemeIcon(tagOrigin ? originIconId[port.origin] : 'circle-outline');
    this.contextValue = 'portEntry';
    this.command = {
      command: 'porthawk.openInBrowser',
      title: 'Open in Browser',
      arguments: [this],
    };
  }
}

export type PorthawkTreeItem = ProcessGroupItem | PortEntryItem;

export class PorthawkTreeProvider implements vscode.TreeDataProvider<PorthawkTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  private ports: PortInfo[] = [];

  constructor(
    private readonly shouldTagOrigin: () => boolean,
    private readonly shouldHideSystemProcesses: () => boolean,
    private readonly getIgnoredProcessNames: () => string[],
    private readonly shouldGroupByProcess: () => boolean,
  ) {}

  setPorts(ports: PortInfo[]): void {
    const changed = !portsEqual(this.ports, ports);
    this.ports = ports;
    if (changed) {
      this.changeEmitter.fire();
    }
  }

  refreshDecorations(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: PorthawkTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PorthawkTreeItem): PorthawkTreeItem[] {
    if (!element) {
      const visible = this.getVisiblePorts();
      if (!this.shouldGroupByProcess()) {
        return this.toPortEntries(visible);
      }
      return groupByProcessName(visible).map(([name, ports]) => new ProcessGroupItem(name, ports));
    }

    if (element instanceof ProcessGroupItem) {
      return this.toPortEntries(element.ports);
    }

    return [];
  }

  private toPortEntries(ports: PortInfo[]): PortEntryItem[] {
    const tagOrigin = this.shouldTagOrigin();
    return ports
      .slice()
      .sort((a, b) => a.port - b.port)
      .map((port) => new PortEntryItem(port, tagOrigin));
  }

  getTotalCount(): number {
    return this.ports.length;
  }

  getVisibleCount(): number {
    return this.getVisiblePorts().length;
  }

  // Public so the dashboard webview renders exactly the same filtered set as
  // the tree — it's an alternative view of this data, not a second source.
  getVisiblePorts(): PortInfo[] {
    const ignored = new Set(this.getIgnoredProcessNames());
    const hideSystem = this.shouldHideSystemProcesses();

    return this.ports.filter((port) => {
      if (hideSystem && isSystemProcess(port.processName)) {
        return false;
      }
      if (ignored.has(port.processName)) {
        return false;
      }
      return true;
    });
  }
}

function groupByProcessName(ports: PortInfo[]): Array<[string, PortInfo[]]> {
  const groups = new Map<string, PortInfo[]>();

  for (const port of ports) {
    const key = port.processName || 'unknown';
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(port);
    } else {
      groups.set(key, [port]);
    }
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
