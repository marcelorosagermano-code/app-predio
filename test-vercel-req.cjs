const express = require('express');
const app = express();

app.use((req, res, next) => {
  console.log('middleware before json');
  next();
});

app.use(express.json());

app.use((req, res, next) => {
  console.log('middleware after json');
  res.json({ ok: true, body: req.body });
});

const http = require('http');
const server = http.createServer((req, res) => {
  // simulate vercel parsing the body
  req.body = { simulated: true };
  
  // mock the stream events so express.json() hangs (because stream is already consumed)
  const oldOn = req.on.bind(req);
  req.on = (event, cb) => {
    if (event === 'data' || event === 'end') {
        // never emit
        return req;
    }
    return oldOn(event, cb);
  }

  app(req, res);
});

server.listen(4444, () => {
  const req = http.request('http://localhost:4444', { method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', data));
  });
  // don't send body, simulating that it's already consumed
  req.end();
  
  setTimeout(() => {
    console.log('Timeout - hanging confirmed!');
    process.exit(0);
  }, 2000);
});
