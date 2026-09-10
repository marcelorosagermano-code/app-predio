const express = require('express');
const app = express();

app.use((req, res, next) => {
  req.body = { fromHack: true };
  req._body = true;
  next();
});

app.use(express.json());

app.post('/test', (req, res) => {
  res.json({ body: req.body });
});

const http = require('http');
const server = http.createServer(app);

server.listen(4444, () => {
  const req = http.request('http://localhost:4444/test', { method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response:', data);
      process.exit(0);
    });
  });
  req.end(); // no body sent
});
