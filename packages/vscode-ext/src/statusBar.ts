import * as vscode from 'vscode';

export class PorthawkStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.name = 'PortHawk';
    // The dashboard is the fuller view, so it's the click target; the sidebar
    // is still one click away from its own Activity Bar icon.
    this.item.command = 'porthawk.openDashboard';
    this.setCount(0);
    this.item.show();
  }

  setCount(count: number): void {
    this.item.text = `$(radio-tower) ${count} server${count === 1 ? '' : 's'}`;
    this.item.tooltip = 'PortHawk — click to open the dashboard';
  }

  dispose(): void {
    this.item.dispose();
  }
}
