import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// first, let's revert all requestedRole to 'morador' to be clean
content = content.replace(/role: requestedRole,/g, "role: 'morador',");
content = content.replace(/verifiedProfile\.role !== requestedRole/g, "verifiedProfile.role !== 'morador'");

const createEndpointStart = "  app.post('/api/admin/create-morador-user'";
const nextEndpointStart = "  app.get('/api/admin/list-users'";

const idxStart = content.indexOf(createEndpointStart);
const idxEnd = content.indexOf(nextEndpointStart);

if (idxStart !== -1 && idxEnd !== -1) {
    let before = content.substring(0, idxStart);
    let createEndpoint = content.substring(idxStart, idxEnd);
    let after = content.substring(idxEnd);
    
    createEndpoint = createEndpoint.replace(/role: 'morador',/g, `role: requestedRole,`);
    createEndpoint = createEndpoint.replace(/verifiedProfile\.role !== 'morador'/g, `verifiedProfile.role !== requestedRole`);
    
    // BUT we also need to ensure activeResident check uses the correct role logic.
    // wait, for now let's just do this.
    
    content = before + createEndpoint + after;
    fs.writeFileSync('server.ts', content);
    console.log('Fixed role in create user');
} else {
    console.log('Endpoint not found');
}
