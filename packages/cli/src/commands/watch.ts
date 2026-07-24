import type { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App } from '../ui/App.js';

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('live view of listening ports')
    .action(async () => {
      if (!process.stdin.isTTY) {
        console.error('portwatch: watch requires an interactive terminal');
        process.exitCode = 1;
        return;
      }

      const instance = render(React.createElement(App));
      await instance.waitUntilExit();
    });
}
