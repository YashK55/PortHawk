import * as vscode from 'vscode';

export class PorthawkStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.name = 'PortHawk';
    this.item.command = 'workbench.view.extension.porthawk';
    this.setCount(0);
    this.item.show();
  }

  setCount(count: number): void {
    this.item.text = `$(radio-tower) ${count} server${count === 1 ? '' : 's'}`;
    this.item.tooltip = 'PortHawk â€” click to view listening ports';
  }

  dispose(): void {
    this.item.dispose();
  }
}
