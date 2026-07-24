#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerKillCommand } from './commands/kill.js';
import { registerWatchCommand } from './commands/watch.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('portwatch')
  .description("see what's listening on your machine's ports and kill what shouldn't be")
  .version(pkg.version);

registerListCommand(program);
registerKillCommand(program);
registerWatchCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`portwatch: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
