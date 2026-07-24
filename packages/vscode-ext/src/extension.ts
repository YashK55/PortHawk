import * as vscode from 'vscode';
import { getListeningPorts, type PortInfo } from '@portwatch/core';
import { PortwatchTreeProvider } from './treeProvider.js';
import { PortwatchStatusBar } from './statusBar.js';
import { registerKillCommand, registerOpenInBrowserCommand } from './commands.js';

function portKey(port: PortInfo): string {
  return `${port.pid}:${port.port}:${port.protocol}`;
}

export function activate(context: vscode.ExtensionContext): void {
  const config = () => vscode.workspace.getConfiguration('portwatch');

  let ports: PortInfo[] = [];
  let knownKeys = new Set<string>();
  let hasBaseline = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const treeProvider = new PortwatchTreeProvider(() => config().get('autoTagAgentProcesses', true));
  const statusBar = new PortwatchStatusBar();
  const treeView = vscode.window.createTreeView('portwatchPorts', { treeDataProvider: treeProvider });

  function notifyNewOrphans(current: PortInfo[]): void {
    const currentKeys = new Set(current.map(portKey));

    if (hasBaseline && config().get('notifyOnNewOrphanedServer', false)) {
      for (const port of current) {
        if (port.origin === 'agent' && !knownKeys.has(portKey(port))) {
          void vscode.window.showInformationMessage(
            `PortWatch: new agent-spawned server on port ${port.port} (${port.processName || 'unknown'}, pid ${port.pid})`,
          );
        }
      }
    }

    knownKeys = currentKeys;
    hasBaseline = true;
  }

  async function refresh(): Promise<void> {
    try {
      ports = await getListeningPorts();
    } catch (error) {
      void vscode.window.showErrorMessage(`PortWatch: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    treeProvider.setPorts(ports);
    statusBar.setCount(ports.length);
    notifyNewOrphans(ports);
  }

  function startPolling(): void {
    if (pollTimer) {
      return;
    }
    const interval = config().get<number>('refreshInterval', 3000);
    pollTimer = setInterval(() => void refresh(), interval);
  }

  function stopPolling(): void {
    if (!pollTimer) {
      return;
    }
    clearInterval(pollTimer);
    pollTimer = undefined;
  }

  context.subscriptions.push(
    treeView,
    treeView.onDidChangeVisibility((event) => {
      if (event.visible) {
        void refresh();
        startPolling();
      } else {
        stopPolling();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('portwatch.refreshInterval') && pollTimer) {
        stopPolling();
        startPolling();
      }
      if (event.affectsConfiguration('portwatch.autoTagAgentProcesses')) {
        treeProvider.refreshDecorations();
      }
    }),
    vscode.commands.registerCommand('portwatch.refresh', () => void refresh()),
    { dispose: () => statusBar.dispose() },
  );

  registerKillCommand(context, () => ports, refresh);
  registerOpenInBrowserCommand(context, () => ports);

  void refresh();
}

export function deactivate(): void {}
