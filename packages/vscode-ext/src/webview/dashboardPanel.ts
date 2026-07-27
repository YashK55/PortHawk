import * as vscode from 'vscode';
import type { PortInfo } from 'porthawk-core';
import { portId, portsEqual } from '../portDiff.js';
import { renderDashboardHtml } from './dashboardHtml.js';

export interface DashboardHooks {
  getPorts: () => PortInfo[];
  killPort: (port: PortInfo) => Promise<void>;
  openPortInBrowser: (port: PortInfo) => Promise<void>;
  onVisibilityChange: () => void;
}

interface WebviewMessage {
  type: string;
  id?: string;
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index++) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}

export class DashboardPanel {
  private static current: DashboardPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private lastSent: PortInfo[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly hooks: DashboardHooks,
  ) {
    panel.webview.html = renderDashboardHtml(createNonce());

    panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => void this.handleMessage(message),
      undefined,
      this.disposables,
    );
    panel.onDidChangeViewState(() => hooks.onVisibilityChange(), undefined, this.disposables);
    panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  static createOrShow(hooks: DashboardHooks): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel('porthawkDashboard', 'PortHawk Dashboard', column, {
      enableScripts: true,
      // The webview loads nothing from disk — its HTML, CSS, and JS are all
      // inline — so it needs access to no local resources at all.
      localResourceRoots: [],
    });

    DashboardPanel.current = new DashboardPanel(panel, hooks);
  }

  static get isVisible(): boolean {
    return DashboardPanel.current?.panel.visible ?? false;
  }

  static pushPorts(ports: PortInfo[]): void {
    DashboardPanel.current?.push(ports);
  }

  private push(ports: PortInfo[], force = false): void {
    // Same diff gate as the tree provider: an unchanged poll posts nothing, so
    // the webview's reconciler isn't woken up to conclude nothing changed.
    if (!force && portsEqual(this.lastSent, ports)) {
      return;
    }
    this.lastSent = ports;
    void this.panel.webview.postMessage({ type: 'ports', ports });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    if (message.type === 'ready') {
      this.push(this.hooks.getPorts(), true);
      return;
    }

    if (message.type !== 'kill' && message.type !== 'open') {
      return;
    }

    // The webview only ever names a port by id; the actual PortInfo is resolved
    // from the extension host's own latest scan, so a stale row can't act on a
    // port that no longer exists.
    const target = this.hooks.getPorts().find((port) => portId(port) === message.id);
    if (!target) {
      void vscode.window.showInformationMessage('PortHawk: that port is no longer listening.');
      return;
    }

    if (message.type === 'kill') {
      await this.hooks.killPort(target);
    } else {
      await this.hooks.openPortInBrowser(target);
    }
  }

  private dispose(): void {
    DashboardPanel.current = undefined;
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.panel.dispose();
    this.hooks.onVisibilityChange();
  }
}
