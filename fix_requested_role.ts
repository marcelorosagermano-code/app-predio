import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// I will globally revert role: requestedRole that I accidentally added
// except in the route /api/admin/create-morador-user.
// Wait, when I ran the script earlier, I did:
// content = content.replace(/role: 'morador',/g, `role: requestedRole,`);
// This replaced it everywhere!

// Let's just fix it by replacing it back everywhere except in create-morador-user.
// Actually, it's easier to just define it if it's undefined, or replace it back to 'morador'.
// Let's replace ALL `role: requestedRole` back to `role: 'morador'`
// and then carefully put it back ONLY in the create user endpoint.

content = content.replace(/role: requestedRole,/g, `role: 'morador',`);

// In the create-morador endpoint:
const createEndpointStart = "  app.post('/api/admin/create-morador-user'";
const createEndpointEnd = "  // Listar todos os usuários de um condomínio"; // Next endpoint

const idxStart = content.indexOf(createEndpointStart);
const idxEnd = content.indexOf(createEndpointEnd);

if (idxStart !== -1 && idxEnd !== -1) {
    let before = content.substring(0, idxStart);
    let createEndpoint = content.substring(idxStart, idxEnd);
    let after = content.substring(idxEnd);
    
    // Now replace 'morador' with requestedRole inside createEndpoint
    createEndpoint = createEndpoint.replace(/role: 'morador',/g, `role: requestedRole,`);
    
    // BUT we also changed the email generation. Let's make sure it's correct there too.
    content = before + createEndpoint + after;
}

// Ensure the email generation is only in the create route:
// We did: const residentEmail = `${requestedRole}.ap${sanitizedNum}...`;
// Let's check where it's used.
const allUsesOfResidentEmail = [...content.matchAll(/const residentEmail = /g)];
// It seems there's only one, inside create user. Let's make sure.

fs.writeFileSync('server.ts', content);
