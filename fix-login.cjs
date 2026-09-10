const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// We need to optimize login queries.
// But wait, they are sequential because they depend on each other.
// 1. unitQuery
// 2. unit_residents
// 3. profiles
