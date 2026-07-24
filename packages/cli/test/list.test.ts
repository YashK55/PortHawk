import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { getListeningPorts } from 'porthawk-core';
import { registerListCommand } from '../src/commands/list.js';

vi.mock('porthawk-core', () => ({
  getListeningPorts: vi.fn(),
}));

const mockedGetListeningPorts = getListeningPorts as unknown as ReturnType<typeof vi.fn>;

describe('porthawk list', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockedGetListeningPorts.mockReset();
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
    registerListCommand(program);
    return program;
  }

  it('prints a message when nothing is listening', async () => {
    mockedGetListeningPorts.mockResolvedValue([]);
    await makeProgram().parseAsync(['node', 'porthawk', 'list']);

    expect(logSpy).toHaveBeenCalledWith('no listening ports found');
    expect(process.exitCode).toBe(0);
  });

  it('renders a table row per listening port, sorted by port', async () => {
    mockedGetListeningPorts.mockResolvedValue([
      { port: 8080, pid: 2, protocol: 'tcp', processName: 'python', command: 'python', origin: 'unknown' },
      { port: 3000, pid: 1, protocol: 'tcp', processName: 'node', command: 'node server.js', origin: 'agent' },
    ]);

    await makeProgram().parseAsync(['node', 'porthawk', 'list']);

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output.indexOf('3000')).toBeLessThan(output.indexOf('8080'));
    expect(output).toContain('node');
    expect(output).toContain('python');
  });

  it('exits non-zero when detection fails', async () => {
    mockedGetListeningPorts.mockRejectedValue(new Error('permission denied'));

    await makeProgram().parseAsync(['node', 'porthawk', 'list']);

    expect(errorSpy).toHaveBeenCalledWith('porthawk: permission denied');
    expect(process.exitCode).toBe(1);
  });
});
