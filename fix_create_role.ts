import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// I will find the /api/admin/create-morador-user endpoint
const createEndpointStart = "  app.post('/api/admin/create-morador-user'";
const createEndpointEnd = "  // Listar todos os usuários de um condomínio";

const idxStart = content.indexOf(createEndpointStart);
const idxEnd = content.indexOf(createEndpointEnd);

if (idxStart !== -1 && idxEnd !== -1) {
    let before = content.substring(0, idxStart);
    let createEndpoint = content.substring(idxStart, idxEnd);
    let after = content.substring(idxEnd);
    
    // Replace hardcoded 'morador' with requestedRole in user_metadata and upsert payload
    createEndpoint = createEndpoint.replace(/role: 'morador',/g, `role: requestedRole,`);
    
    content = before + createEndpoint + after;
    fs.writeFileSync('server.ts', content);
    console.log('Fixed role in create user');
} else {
    console.log('Endpoint not found');
}
