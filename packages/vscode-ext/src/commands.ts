import * as vscode from 'vscode';
import { killProcess, type PortInfo } from 'porthawk-core';
import { PortEntryItem } from './treeProvider.js';

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
        label: `:${port.port} â€” ${port.processName || 'unknown'}`,
        description: `pid ${port.pid} Â· ${port.origin}`,
        port,
      })),
    { placeHolder: 'Select a listening port' },
  );

  return picked?.port;
}

function resolvePort(item: unknown, getPorts: () => PortInfo[]): Promise<PortInfo | undefined> {
  if (item instanceof PortEntryItem) {
    return Promise.resolve(item.port);
  }
  return pickPort(getPorts);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerKillCommand(
  context: vscode.ExtensionContext,
  getPorts: () => PortInfo[],
  refresh: () => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.killProcess', async (item?: unknown) => {
      const target = await resolvePort(item, getPorts);
      if (!target) {
        return;
      }

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
    }),
  );
}

export function registerOpenInBrowserCommand(context: vscode.ExtensionContext, getPorts: () => PortInfo[]): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('porthawk.openInBrowser', async (item?: unknown) => {
      const target = await resolvePort(item, getPorts);
      if (!target) {
        return;
      }
      await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${target.port}`));
    }),
  );
}
