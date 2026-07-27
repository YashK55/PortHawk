import * as vscode from 'vscode';
import { getListeningPorts, type PortInfo } from 'porthawk-core';
import { PorthawkTreeProvider, PortEntryItem } from './treeProvider.js';
import { PorthawkStatusBar } from './statusBar.js';
import { portId } from './portDiff.js';
import { DashboardPanel } from './webview/dashboardPanel.js';
import {
  confirmAndKillPort,
  openPortInBrowser,
  registerCopyCommands,
  registerIgnoreCommands,
  registerKillCommand,
  registerKillProcessGroupCommand,
  registerOpenInBrowserCommand,
  registerToggleHideSystemProcessesCommand,
} from './commands.js';

const GROUPING_STATE_KEY = 'porthawk.groupByProcess';

export function activate(context: vscode.ExtensionContext): void {
  const config = () => vscode.workspace.getConfiguration('porthawk');

  let ports: PortInfo[] = [];
  let knownKeys = new Set<string>();
  let hasBaseline = false;
  let hasScanned = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let groupByProcess = context.workspaceState.get<boolean>(GROUPING_STATE_KEY, true);

  const treeProvider = new PorthawkTreeProvider(
    () => config().get('autoTagAgentProcesses', true),
    () => config().get('hideSystemProcesses', true),
    () => config().get('ignoredProcessNames', []),
    () => groupByProcess,
  );
  const statusBar = new PorthawkStatusBar();
  const treeView = vscode.window.createTreeView('porthawkPorts', { treeDataProvider: treeProvider });

  function notifyNewOrphans(current: PortInfo[]): void {
    const currentKeys = new Set(current.map(portId));

    if (hasBaseline && config().get('notifyOnNewOrphanedServer', false)) {
      for (const port of current) {
        if (port.origin === 'agent' && !knownKeys.has(portId(port))) {
          void vscode.window.showInformationMessage(
            `PortHawk: new agent-spawned server on port ${port.port} (${port.processName || 'unknown'}, pid ${port.pid})`,
          );
        }
      }
    }

    knownKeys = currentKeys;
    hasBaseline = true;
  }

  // The welcome view (contributes.viewsWelcome) takes over whenever the tree has
  // no children. This key picks which of the two empty states it explains, so
  // "nothing is listening" and "everything is filtered out" stay distinguishable.
  function updateEmptyStateContext(): void {
    // Before the first scan lands the tree is empty but nothing is known yet,
    // so claiming "nothing is listening" would be wrong. Staying blank leaves
    // the view's native progress spinner as the only thing on screen.
    let reason = '';
    if (hasScanned) {
      if (treeProvider.getTotalCount() === 0) {
        reason = 'none';
      } else if (treeProvider.getVisibleCount() === 0) {
        reason = 'filtered';
      }
    }
    void vscode.commands.executeCommand('setContext', 'porthawk.treeEmptyReason', reason);
  }

  function updateGroupingContext(): void {
    void vscode.commands.executeCommand('setContext', 'porthawk.groupByProcess', groupByProcess);
  }

  async function setGrouping(next: boolean): Promise<void> {
    groupByProcess = next;
    await context.workspaceState.update(GROUPING_STATE_KEY, next);
    updateGroupingContext();
    treeProvider.refreshDecorations();
  }

  // A keypress carries no tree item, unlike a context-menu click, so commands
  // fall back to whatever the tree currently has highlighted.
  function getSelectedPort(): PortInfo | undefined {
    for (const item of treeView.selection) {
      if (item instanceof PortEntryItem) {
        return item.port;
      }
    }
    return undefined;
  }

  const portAccess = { getPorts: () => ports, getSelectedPort };

  async function refresh(): Promise<void> {
    try {
      ports = await vscode.window.withProgress({ location: { viewId: 'porthawkPorts' } }, () => getListeningPorts());
    } catch (error) {
      void vscode.window.showErrorMessage(`PortHawk: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    hasScanned = true;
    treeProvider.setPorts(ports);
    statusBar.setCount(ports.length);
    notifyNewOrphans(ports);
    updateEmptyStateContext();
    DashboardPanel.pushPorts(treeProvider.getVisiblePorts());
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

  // Either surface being on screen is reason enough to keep scanning; neither
  // being on screen means nobody can see the result, so stop.
  function syncPollingToVisibility(): void {
    if (treeView.visible || DashboardPanel.isVisible) {
      startPolling();
    } else {
      stopPolling();
    }
  }

  context.subscriptions.push(
    treeView,
    treeView.onDidChangeVisibility((event) => {
      if (event.visible) {
        void refresh();
      }
      syncPollingToVisibility();
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
        updateEmptyStateContext();
        DashboardPanel.pushPorts(treeProvider.getVisiblePorts());
      }
    }),
    vscode.commands.registerCommand('porthawk.refresh', () => void refresh()),
    vscode.commands.registerCommand('porthawk.openDashboard', () => {
      DashboardPanel.createOrShow({
        getPorts: () => treeProvider.getVisiblePorts(),
        killPort: (port) => confirmAndKillPort(port, refresh),
        openPortInBrowser,
        onVisibilityChange: syncPollingToVisibility,
      });
      syncPollingToVisibility();
      void refresh();
    }),
    vscode.commands.registerCommand('porthawk.groupByProcess', () => void setGrouping(true)),
    vscode.commands.registerCommand('porthawk.showFlatList', () => void setGrouping(false)),
    { dispose: () => statusBar.dispose() },
  );

  registerKillCommand(context, portAccess, refresh);
  registerOpenInBrowserCommand(context, portAccess);
  registerCopyCommands(context, portAccess);
  registerKillProcessGroupCommand(context, refresh);
  registerIgnoreCommands(context);
  registerToggleHideSystemProcessesCommand(context);

  updateGroupingContext();
  updateEmptyStateContext();
  void refresh();
}

export function deactivate(): void {}
