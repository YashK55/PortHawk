import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { getListeningPorts, killProcess } from 'porthawk-core';
import { App } from '../src/ui/App.js';

vi.mock('porthawk-core', () => ({
  getListeningPorts: vi.fn(),
  killProcess: vi.fn(),
}));

const mockedGetListeningPorts = getListeningPorts as unknown as ReturnType<typeof vi.fn>;
const mockedKillProcess = killProcess as unknown as ReturnType<typeof vi.fn>;

function flush(ticks = 3) {
  return new Promise<void>((resolve) => {
    let remaining = ticks;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  });
}

describe('watch TUI', () => {
  beforeEach(() => {
    mockedGetListeningPorts.mockReset();
    mockedKillProcess.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('lists detected ports and tags agent origin', async () => {
    mockedGetListeningPorts.mockResolvedValue([
      { port: 3000, pid: 1, protocol: 'tcp', processName: 'node', command: 'node server.js', origin: 'agent' },
    ]);

    const instance = render(<App />);
    await flush();

    expect(instance.lastFrame()).toContain(':3000');
    expect(instance.lastFrame()).toContain('node');
    expect(instance.lastFrame()).toContain('[agent]');
  });

  it('asks for confirmation before killing, then kills on y', async () => {
    mockedGetListeningPorts.mockResolvedValue([
      { port: 3000, pid: 4242, protocol: 'tcp', processName: 'node', command: 'node server.js', origin: 'agent' },
    ]);
    mockedKillProcess.mockResolvedValue(undefined);

    const instance = render(<App />);
    await flush();

    instance.stdin.write('k');
    await flush();
    expect(instance.lastFrame()).toContain('kill node (pid 4242) on port 3000?');
    expect(mockedKillProcess).not.toHaveBeenCalled();

    instance.stdin.write('y');
    await flush();
    expect(mockedKillProcess).toHaveBeenCalledWith(4242);
  });

  it('cancels the kill on n without calling core', async () => {
    mockedGetListeningPorts.mockResolvedValue([
      { port: 3000, pid: 4242, protocol: 'tcp', processName: 'node', command: 'node server.js', origin: 'agent' },
    ]);

    const instance = render(<App />);
    await flush();

    instance.stdin.write('k');
    await flush();
    instance.stdin.write('n');
    await flush();

    expect(mockedKillProcess).not.toHaveBeenCalled();
    expect(instance.lastFrame()).not.toContain('on port 3000?');
  });
});
