import type { PortInfo } from 'porthawk-core';

export function portId(port: PortInfo): string {
  return `${port.pid}:${port.port}:${port.protocol}`;
}

function portSignature(port: PortInfo): string {
  return [port.port, port.protocol, port.pid, port.processName, port.origin, port.command].join(' ');
}

// Order-independent so a poll that returns the same ports in a different
// array order doesn't count as a change and trigger a re-render.
export function portsEqual(a: PortInfo[], b: PortInfo[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = a.map(portSignature).sort();
  const sortedB = b.map(portSignature).sort();
  return sortedA.every((signature, index) => signature === sortedB[index]);
}
