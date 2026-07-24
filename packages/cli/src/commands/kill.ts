import type { Command } from 'commander';
import * as clack from '@clack/prompts';
import { getListeningPorts, killProcess } from '@portwatch/core';

export function registerKillCommand(program: Command): void {
  program
    .command('kill <port>')
    .description('kill whatever is listening on a port')
    .action(async (portArg: string) => {
      const port = Number(portArg);
      if (!Number.isInteger(port) || port <= 0) {
        console.error(`portwatch: invalid port "${portArg}"`);
        process.exitCode = 1;
        return;
      }

      try {
        const ports = await getListeningPorts();
        const match = ports.find((entry) => entry.port === port);

        if (!match) {
          console.error(`portwatch: nothing is listening on port ${port}`);
          process.exitCode = 1;
          return;
        }

        const confirmed = await clack.confirm({
          message: `kill ${match.processName || 'unknown process'} (pid ${match.pid}) listening on port ${port}?`,
          initialValue: false,
        });

        if (clack.isCancel(confirmed) || !confirmed) {
          clack.cancel('not killed');
          return;
        }

        await killProcess(match.pid);
        console.log(`killed ${match.processName || 'unknown process'} (pid ${match.pid})`);
      } catch (error) {
        console.error(`portwatch: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
      }
    });
}
