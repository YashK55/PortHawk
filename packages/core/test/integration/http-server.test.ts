import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { getListeningPorts, killProcess } from '../../src/index.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(dirname, 'fixtures', 'http-server.mjs');

function waitForListeningPort(child: ChildProcessWithoutNullStreams): Promise<number> {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = /LISTENING (\d+)/.exec(buffer);
      if (match?.[1]) {
        child.stdout.off('data', onData);
        resolve(Number(match[1]));
      }
    };

    child.stdout.on('data', onData);
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`fixture server exited early with code ${code}`)));
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
  });
}

describe('getListeningPorts + killProcess against a real process', () => {
  let child: ChildProcessWithoutNullStreams | undefined;

  afterEach(() => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
    child = undefined;
  });

  it('detects a real listening server and kills it', async () => {
    child = spawn(process.execPath, [fixturePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    const port = await waitForListeningPort(child);
    const pid = child.pid;
    if (!pid) {
      throw new Error('fixture server did not report a pid');
    }

    const ports = await getListeningPorts();
    const match = ports.find((entry) => entry.pid === pid && entry.port === port);

    expect(match).toBeDefined();
    expect(match?.protocol).toBe('tcp');

    const exited = waitForExit(child);
    await killProcess(pid);
    await exited;

    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }, 60_000);
});
