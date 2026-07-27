import * as vscode from 'vscode';
import { killProcess, type PortInfo } from 'porthawk-core';
import { PortEntryItem, ProcessGroupItem } from './treeProvider.js';

// How a command figures out which port it's acting on. `getSelectedPort` lets a
// keybinding act on whatever is highlighted in the tree, since a keypress —
// unlike a context-menu click — passes no tree item along.
export interface PortAccess {
  getPorts: () => PortInfo[];
  getSelectedPort: () => PortInfo | undefined;
}

async function pickPort(getPorts: () => PortInfo[]): Promise<PortInfo | undefined> {
  const ports = getPorts();

  if (ports.length === 0) {
    void vscode.window.showInformationMessage('PortHawk: no listening ports detected.');
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    ports
      .slice()
      .sort((a, b) => a.port - b.port)
      .map((port) => ({
        label: `:${port.port} — ${port.processName || 'unknown'}`,
        description: `pid ${port.pid} · ${port.origin}`,
        port,
      })),
    { placeHolder: 'Select a listening port' },
  );

  return picked?.port;
}

function resolvePort(item: unknown, access: PortAccess): Promise<PortInfo | undefined> {
  if (item instanceof PortEntryItem) {
    return Promise.resolve(item.port);
  }

  const selected = access.getSelectedPort();
  if (selected) {
    return Promise.resolve(selected);
  }

  return pickPort(access.getPorts);
}

function resolveProcessName(item: unknown): string | undefined {
  if (item instanceof PortEntryItem) {
    return item.port.processName;
  }
  if (item instanceof ProcessGroupItem) {
    return item.processName;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Exported so the dashboard webview kills through the exact same confirmation
// prompt as the tree view — the webview never reaches killProcess() directly.
export async function confirmAndKillPort(target: PortInfo, refresh: () => Promise<void>): Promise<void> {
  const confirmed = await vscode.window.showWarningMessage(
    `Kill ${target.processName || 'unknown process'} (pid ${target.pid}) listening on port ${target.port}?`,
    { modal: true },
    'Kill Process',
  );
  if (confirmed !== 'Kill Process') {
    return;
  }

  try {
    await killProcess(target.pid);
    await refresh();
  } catch (error) {
    void vscode.window.showErrorMessage(`PortHawk: ${errorMessage(error)}`);
  }
}

export async function openPortInBrowser(target: PortInfo): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${target.port}`));
}

export function registerKillCommand(
  context: vscode.ExtensionContext,
  access: PortAccess,
  refresh: () => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.killProcess', async (item?: unknown) => {
      const target = await resolvePort(item, access);
      if (target) {
        await confirmAndKillPort(target, refresh);
      }
    }),
  );
}

export function registerOpenInBrowserCommand(context: vscode.ExtensionContext, access: PortAccess): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.openInBrowser', async (item?: unknown) => {
      const target = await resolvePort(item, access);
      if (target) {
        await openPortInBrowser(target);
      }
    }),
  );
}

export function registerCopyCommands(context: vscode.ExtensionContext, access: PortAccess): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.copyPort', async (item?: unknown) => {
      const target = await resolvePort(item, access);
      if (!target) {
        return;
      }
      await vscode.env.clipboard.writeText(String(target.port));
    }),
    vscode.commands.registerCommand('porthawk.copyPid', async (item?: unknown) => {
      const target = await resolvePort(item, access);
      if (!target) {
        return;
      }
      await vscode.env.clipboard.writeText(String(target.pid));
    }),
  );
}

export function registerKillProcessGroupCommand(context: vscode.ExtensionContext, refresh: () => Promise<void>): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.killProcessGroup', async (item?: unknown) => {
      if (!(item instanceof ProcessGroupItem)) {
        return;
      }

      const uniquePids = [...new Set(item.ports.map((port) => port.pid))];
      const confirmed = await vscode.window.showWarningMessage(
        `Kill all ${uniquePids.length} ${item.processName} process${uniquePids.length === 1 ? '' : 'es'} (${item.ports.length} port${item.ports.length === 1 ? '' : 's'})?`,
        { modal: true },
        'Kill All',
      );
      if (confirmed !== 'Kill All') {
        return;
      }

      const errors: string[] = [];
      for (const pid of uniquePids) {
        try {
          await killProcess(pid);
        } catch (error) {
          errors.push(errorMessage(error));
        }
      }

      if (errors.length > 0) {
        void vscode.window.showErrorMessage(`PortHawk: ${errors.join('; ')}`);
      }
      await refresh();
    }),
  );
}

function getIgnoredProcessNames(): string[] {
  return vscode.workspace.getConfiguration('porthawk').get<string[]>('ignoredProcessNames', []);
}

async function setIgnoredProcessNames(names: string[]): Promise<void> {
  await vscode.workspace
    .getConfiguration('porthawk')
    .update('ignoredProcessNames', names, vscode.ConfigurationTarget.Global);
}

export function registerIgnoreCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.ignoreProcess', async (item?: unknown) => {
      const name = resolveProcessName(item);
      if (!name) {
        void vscode.window.showInformationMessage('PortHawk: select a process to ignore first.');
        return;
      }

      const current = getIgnoredProcessNames();
      if (!current.includes(name)) {
        await setIgnoredProcessNames([...current, name]);
      }
      void vscode.window.showInformationMessage(
        `PortHawk: "${name}" will be hidden from the list. Undo with "PortHawk: Clear Ignored Processes".`,
      );
    }),
    vscode.commands.registerCommand('porthawk.clearIgnoredProcesses', async () => {
      await setIgnoredProcessNames([]);
      void vscode.window.showInformationMessage('PortHawk: cleared ignored processes.');
    }),
  );
}

export function registerToggleHideSystemProcessesCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.toggleHideSystemProcesses', async () => {
      const config = vscode.workspace.getConfiguration('porthawk');
      const current = config.get<boolean>('hideSystemProcesses', true);
      await config.update('hideSystemProcesses', !current, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(
        `PortHawk: system processes are now ${current ? 'shown' : 'hidden'}.`,
      );
    }),
  );
}
