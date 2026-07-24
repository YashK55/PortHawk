import * as vscode from 'vscode';
import { isSystemProcess, type Origin, type PortInfo } from 'porthawk-core';

const originIconId: Record<Origin, string> = {
  agent: 'circuit-board',
  manual: 'person',
  unknown: 'question',
};

export class ProcessGroupItem extends vscode.TreeItem {
  constructor(
    public readonly processName: string,
    public readonly ports: PortInfo[],
  ) {
    super(processName, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('server-process');
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
    this.description = `${port.protocol} · pid ${port.pid}`;
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
  ) {}

  setPorts(ports: PortInfo[]): void {
    this.ports = ports;
    this.changeEmitter.fire();
  }

  refreshDecorations(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: PorthawkTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PorthawkTreeItem): PorthawkTreeItem[] {
    if (!element) {
      return groupByProcessName(this.getVisiblePorts()).map(([name, ports]) => new ProcessGroupItem(name, ports));
    }

    if (element instanceof ProcessGroupItem) {
      return element.ports
        .slice()
        .sort((a, b) => a.port - b.port)
        .map((port) => new PortEntryItem(port, this.shouldTagOrigin()));
    }

    return [];
  }

  getTotalCount(): number {
    return this.ports.length;
  }

  getVisibleCount(): number {
    return this.getVisiblePorts().length;
  }

  private getVisiblePorts(): PortInfo[] {
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
