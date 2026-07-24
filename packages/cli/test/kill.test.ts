import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { getListeningPorts, killProcess } from 'porthawk-core';
import * as clack from '@clack/prompts';
import { registerKillCommand } from '../src/commands/kill.js';

vi.mock('porthawk-core', () => ({
  getListeningPorts: vi.fn(),
  killProcess: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

const mockedGetListeningPorts = getListeningPorts as unknown as ReturnType<typeof vi.fn>;
const mockedKillProcess = killProcess as unknown as ReturnType<typeof vi.fn>;
const mockedConfirm = clack.confirm as unknown as ReturnType<typeof vi.fn>;
const mockedIsCancel = clack.isCancel as unknown as ReturnType<typeof vi.fn>;
const mockedCancel = clack.cancel as unknown as ReturnType<typeof vi.fn>;

const samplePort = {
  port: 3000,
  pid: 4242,
  protocol: 'tcp' as const,
  processName: 'node',
  command: 'node server.js',
  origin: 'agent' as const,
};

describe('porthawk kill', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockedGetListeningPorts.mockReset();
    mockedKillProcess.mockReset();
    mockedConfirm.mockReset();
    mockedIsCancel.mockReset().mockReturnValue(false);
    mockedCancel.mockReset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = 0;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = 0;
  });

  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerKillCommand(program);
    return program;
  }

  it('rejects a non-numeric port without calling core', async () => {
    await makeProgram().parseAsync(['node', 'porthawk', 'kill', 'abc']);

    expect(errorSpy).toHaveBeenCalledWith('porthawk: invalid port "abc"');
    expect(process.exitCode).toBe(1);
    expect(mockedGetListeningPorts).not.toHaveBeenCalled();
  });

  it('exits non-zero when nothing listens on the given port', async () => {
    mockedGetListeningPorts.mockResolvedValue([]);

    await makeProgram().parseAsync(['node', 'porthawk', 'kill', '3000']);

    expect(errorSpy).toHaveBeenCalledWith('porthawk: nothing is listening on port 3000');
    expect(process.exitCode).toBe(1);
  });

  it('does not kill when the user declines confirmation', async () => {
    mockedGetListeningPorts.mockResolvedValue([samplePort]);
    mockedConfirm.mockResolvedValue(false);

    await makeProgram().parseAsync(['node', 'porthawk', 'kill', '3000']);

    expect(mockedKillProcess).not.toHaveBeenCalled();
    expect(mockedCancel).toHaveBeenCalledWith('not killed');
  });

  it('does not kill when the confirmation prompt is cancelled', async () => {
    mockedGetListeningPorts.mockResolvedValue([samplePort]);
    mockedConfirm.mockResolvedValue(Symbol('cancel'));
    mockedIsCancel.mockReturnValue(true);

    await makeProgram().parseAsync(['node', 'porthawk', 'kill', '3000']);

    expect(mockedKillProcess).not.toHaveBeenCalled();
  });

  it('kills the matched process after explicit confirmation', async () => {
    mockedGetListeningPorts.mockResolvedValue([samplePort]);
    mockedConfirm.mockResolvedValue(true);
    mockedKillProcess.mockResolvedValue(undefined);

    await makeProgram().parseAsync(['node', 'porthawk', 'kill', '3000']);

    expect(mockedKillProcess).toHaveBeenCalledWith(4242);
    expect(logSpy).toHaveBeenCalledWith('killed node (pid 4242)');
  });

  it('exits non-zero when killProcess fails', async () => {
    mockedGetListeningPorts.mockResolvedValue([samplePort]);
    mockedConfirm.mockResolvedValue(true);
    mockedKillProcess.mockRejectedValue(new Error('operation not permitted'));

    await makeProgram().parseAsync(['node', 'porthawk', 'kill', '3000']);

    expect(errorSpy).toHaveBeenCalledWith('porthawk: operation not permitted');
    expect(process.exitCode).toBe(1);
  });
});
