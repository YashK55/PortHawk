import { describe, expect, it } from 'vitest';
import { classifyOrigin, isSystemProcess } from '../src/classify.js';

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

describe('isSystemProcess', () => {
  it('recognizes common Windows system processes', () => {
    expect(isSystemProcess('svchost.exe')).toBe(true);
    expect(isSystemProcess('System')).toBe(true);
    expect(isSystemProcess('lsass.exe')).toBe(true);
  });

  it('recognizes common Unix system daemons', () => {
    expect(isSystemProcess('systemd')).toBe(true);
    expect(isSystemProcess('launchd')).toBe(true);
  });

  it('does not flag ordinary dev-server processes', () => {
    expect(isSystemProcess('node.exe')).toBe(false);
    expect(isSystemProcess('python3')).toBe(false);
    expect(isSystemProcess('nginx')).toBe(false);
  });
});
