import type { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { getListeningPorts } from 'porthawk-core';
import { colorizeOrigin } from '../format.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('list all listening ports')
    .action(async () => {
      try {
        const ports = await getListeningPorts();

        if (ports.length === 0) {
          console.log('no listening ports found');
          return;
        }

        const table = new Table({ head: [pc.bold('PORT'), pc.bold('PROCESS'), pc.bold('PID'), pc.bold('ORIGIN')] });

        for (const port of ports.sort((a, b) => a.port - b.port)) {
          table.push([String(port.port), port.processName || '?', String(port.pid), colorizeOrigin(port.origin)]);
        }

        console.log(table.toString());
      } catch (error) {
        console.error(`porthawk: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
      }
    });
}
