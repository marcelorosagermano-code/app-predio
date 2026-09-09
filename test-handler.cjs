const express = require('express');
const app = express();
app.post('/api/auth/morador-login', (req, res) => res.json({ ok: true }));
app.use((req, res) => res.status(404).json({ error: 'not found' }));

const http = require('http');
const server = http.createServer((req, res) => {
  // api/index.ts logic
  let targetPath = '';
  const parsedUrl = new URL(req.url, 'http://localhost');
  const qPath = parsedUrl.searchParams.get('path');
  if (qPath) targetPath = '/api/' + String(qPath).replace(/^\//, '').split('?')[0];
  if (targetPath) req.url = targetPath;
  console.log('Final req.url:', req.url);
  app(req, res);
});
server.listen(3001, () => {
  const req = http.request('http://localhost:3001/api?path=auth/morador-login', { method: 'POST' }, (res) => {
    res.on('data', d => console.log(d.toString()));
    process.exit(0);
  });
  req.end();
});
