const { createApiApp } = require('./dist/server.cjs');
const app = createApiApp();
const http = require('http');

const server = http.createServer((req, res) => {
  req.body = { targetProfileId: "123", currentSindicoId: "456" };
  const oldOn = req.on.bind(req);
  req.on = (event, cb) => {
    if (event === 'data' || event === 'end') return req;
    return oldOn(event, cb);
  };
  
  app(req, res);
});

server.listen(4444, () => {
  const req = http.request('http://localhost:4444/api/admin/transfer-sindicancia', { 
    method: 'POST', 
    headers: { 'content-type': 'application/json' } 
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      process.exit(0);
    });
  });
  req.end();
  
  setTimeout(() => {
    console.log('Timeout - hanging in transfer-sindicancia!');
    process.exit(1);
  }, 2000);
});
