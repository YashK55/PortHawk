import { describe, expect, it } from 'vitest';
import { classifyOrigin } from '../src/classify.js';

describe('classifyOrigin', () => {
  it('tags a known agent CLI process directly', () => {
    expect(
      classifyOrigin({ pid: 1, processName: 'claude', command: 'claude', parentName: '' }),
    ).toBe('agent');
  });

  it('tags a node process spawned from an editor terminal as agent', () => {
    expect(
      classifyOrigin({ pid: 2, processName: 'node', command: 'node server.js', parentName: 'Code Helper' }),
    ).toBe('agent');
  });

  it('leaves a node process with an unrelated parent as unknown', () => {
    expect(
      classifyOrigin({ pid: 3, processName: 'node', command: 'node server.js', parentName: 'systemd' }),
    ).toBe('unknown');
  });

  it('falls back to unknown when nothing matches', () => {
    expect(
      classifyOrigin({ pid: 4, processName: 'nginx', command: 'nginx', parentName: 'init' }),
    ).toBe('unknown');
  });
});
