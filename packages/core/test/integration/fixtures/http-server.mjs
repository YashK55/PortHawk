import http from 'node:http';

const server = http.createServer((_req, res) => {
  res.end('ok');
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  process.stdout.write(`LISTENING ${port}\n`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
