import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { getListeningPorts, killProcess, type PortInfo } from 'porthawk-core';

const REFRESH_INTERVAL_MS = 2000;

type Status = 'idle' | 'confirm-kill' | 'killing';

export function App(): React.ReactElement {
  const { exit } = useApp();
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getListeningPorts();
      setPorts(next);
      setError(null);
      setSelectedIndex((current) => Math.min(current, Math.max(next.length - 1, 0)));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      if (status === 'idle') void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh, status]);

  useInput((input, key) => {
    if (status === 'confirm-kill') {
      if (input === 'y' || key.return) {
        const target = ports[selectedIndex];
        if (!target) {
          setStatus('idle');
          return;
        }
        setStatus('killing');
        killProcess(target.pid)
          .then(() => {
            setMessage(`killed ${target.processName || 'unknown process'} (pid ${target.pid})`);
            setStatus('idle');
            void refresh();
          })
          .catch((killError: unknown) => {
            setError(killError instanceof Error ? killError.message : String(killError));
            setStatus('idle');
          });
        return;
      }

      if (input === 'n' || key.escape) {
        setStatus('idle');
      }
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((current) => Math.min(current + 1, Math.max(ports.length - 1, 0)));
      return;
    }

    if (input === 'k' && ports.length > 0) {
      setMessage(null);
      setStatus('confirm-kill');
    }
  });

  const selected = ports[selectedIndex];

  return (
    <Box flexDirection="column">
      <Text dimColor>porthawk watch — ↑/↓ select, k kill, q quit</Text>
      <Box flexDirection="column" marginTop={1}>
        {ports.length === 0 && <Text dimColor>no listening ports found</Text>}
        {ports.map((port, index) => {
          const isSelected = index === selectedIndex;
          const label = `:${port.port}  ${port.processName || '?'}  (pid ${port.pid})`;
          return (
            <Text key={`${port.pid}:${port.port}:${port.protocol}`} color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '> ' : '  '}
              {label}
              {port.origin === 'agent' ? ' [agent]' : ''}
            </Text>
          );
        })}
      </Box>
      {status === 'confirm-kill' && selected && (
        <Box marginTop={1}>
          <Text color="yellow">
            kill {selected.processName || 'unknown process'} (pid {selected.pid}) on port {selected.port}? (y/n)
          </Text>
        </Box>
      )}
      {status === 'killing' && (
        <Box marginTop={1}>
          <Text dimColor>killing…</Text>
        </Box>
      )}
      {message && status === 'idle' && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
