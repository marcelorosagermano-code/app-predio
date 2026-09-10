const http = require('http');
const express = require('express');
const { createApiApp } = require('./dist/server.cjs'); // Wait, let's just use curl against the local dev server

fetch('http://localhost:3000/api/admin/transfer-sindicancia', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token'
  },
  body: JSON.stringify({ targetProfileId: '123' })
})
.then(async r => console.log(r.status, await r.text()))
.catch(console.error);
