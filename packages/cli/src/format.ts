import pc from 'picocolors';
import type { Origin } from '@portwatch/core';

export function colorizeOrigin(origin: Origin): string {
  if (origin === 'agent') return pc.yellow(origin);
  if (origin === 'manual') return pc.green(origin);
  return pc.dim(origin);
}
