import * as vscode from 'vscode';
import { getListeningPorts, type PortInfo } from 'porthawk-core';
import { PorthawkTreeProvider } from './treeProvider.js';
import { PorthawkStatusBar } from './statusBar.js';
import {
  registerCopyCommands,
  registerIgnoreCommands,
  registerKillCommand,
  registerKillProcessGroupCommand,
  registerOpenInBrowserCommand,
  registerToggleHideSystemProcessesCommand,
} from './commands.js';

function portKey(port: PortInfo): string {
  return `${port.pid}:${port.port}:${port.protocol}`;
}

export function activate(context: vscode.ExtensionContext): void {
  const config = () => vscode.workspace.getConfiguration('porthawk');

  let ports: PortInfo[] = [];
  let knownKeys = new Set<string>();
  let hasBaseline = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const treeProvider = new PorthawkTreeProvider(
    () => config().get('autoTagAgentProcesses', true),
    () => config().get('hideSystemProcesses', true),
    () => config().get('ignoredProcessNames', []),
  );
  const statusBar = new PorthawkStatusBar();
  const treeView = vscode.window.createTreeView('porthawkPorts', { treeDataProvider: treeProvider });

  function notifyNewOrphans(current: PortInfo[]): void {
    const currentKeys = new Set(current.map(portKey));

    if (hasBaseline && config().get('notifyOnNewOrphanedServer', false)) {
      for (const port of current) {
        if (port.origin === 'agent' && !knownKeys.has(portKey(port))) {
          void vscode.window.showInformationMessage(
            `PortHawk: new agent-spawned server on port ${port.port} (${port.processName || 'unknown'}, pid ${port.pid})`,
          );
        }
      }
    }

    knownKeys = currentKeys;
    hasBaseline = true;
  }

  function updateTreeMessage(): void {
    const total = treeProvider.getTotalCount();
    const visible = treeProvider.getVisibleCount();

    if (total === 0) {
      treeView.message = 'No listening ports found.';
    } else if (visible === 0) {
      treeView.message = 'All ports are hidden by hideSystemProcesses or ignored processes — adjust in Settings.';
    } else {
      treeView.message = undefined;
    }
  }

  async function refresh(): Promise<void> {
    treeView.message = 'Refreshing…';

    try {
      ports = await getListeningPorts();
    } catch (error) {
      treeView.message = undefined;
      void vscode.window.showErrorMessage(`PortHawk: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    treeProvider.setPorts(ports);
    statusBar.setCount(ports.length);
    notifyNewOrphans(ports);
    updateTreeMessage();
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
      if (event.affectsConfiguration('porthawk.refreshInterval') && pollTimer) {
        stopPolling();
        startPolling();
      }
      if (event.affectsConfiguration('porthawk.autoTagAgentProcesses')) {
        treeProvider.refreshDecorations();
      }
      if (
        event.affectsConfiguration('porthawk.hideSystemProcesses') ||
        event.affectsConfiguration('porthawk.ignoredProcessNames')
      ) {
        treeProvider.refreshDecorations();
        updateTreeMessage();
      }
    }),
    vscode.commands.registerCommand('porthawk.refresh', () => void refresh()),
    { dispose: () => statusBar.dispose() },
  );

  registerKillCommand(context, () => ports, refresh);
  registerOpenInBrowserCommand(context, () => ports);
  registerCopyCommands(context, () => ports);
  registerKillProcessGroupCommand(context, refresh);
  registerIgnoreCommands(context);
  registerToggleHideSystemProcessesCommand(context);

  void refresh();
}

export function deactivate(): void {}
