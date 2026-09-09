import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const createEndpointStart = "  app.post('/api/admin/create-morador-user'";
const nextEndpointStart = "  app.post('/api/admin/delete-morador-user'";

const idxStart = content.indexOf(createEndpointStart);
const idxEnd = content.indexOf(nextEndpointStart);

if (idxStart !== -1 && idxEnd !== -1) {
    let before = content.substring(0, idxStart);
    let createEndpoint = content.substring(idxStart, idxEnd);
    let after = content.substring(idxEnd);
    
    createEndpoint = createEndpoint.replace(/role: 'morador',/g, `role: requestedRole,`);
    createEndpoint = createEndpoint.replace(/verifiedProfile\.role !== 'morador'/g, `verifiedProfile.role !== requestedRole`);
    
    // Also, checking if activeResident already exists:
    // line: (r.profile_id && r.profiles && r.profiles.is_active && r.profiles.role === 'morador')
    // Maybe we shouldn't allow ANY active resident? Wait, what if we want to add a Sindico?
    // Sindico is a profile. The unit is assigned. That's fine.
    
    content = before + createEndpoint + after;
    fs.writeFileSync('server.ts', content);
    console.log('Fixed role in create user');
} else {
    console.log('Endpoint not found');
}
