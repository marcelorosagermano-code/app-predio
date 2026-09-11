const fs = require('fs');

const serverTs = fs.readFileSync('server.ts', 'utf8');

// We will find the start of transfer-sindicancia and the end of delete-morador-user.
const startIndex = serverTs.indexOf("app.post('/api/admin/transfer-sindicancia'");
const endIndexText = "  // 8. Registrar trilha de auditoria";
const deleteEndIndex = serverTs.indexOf("app.use((req, res, next) => {", startIndex);

const before = serverTs.substring(0, startIndex);
const after = serverTs.substring(deleteEndIndex - 39); // approximate back up to 'createApiApp'

console.log("Found bounds:", startIndex, deleteEndIndex);
