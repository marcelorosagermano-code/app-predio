const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
"  });\n\n  // =========================================================\n\nexport function createApiApp",
"  });\n}\n\n  // =========================================================\n\nexport function createApiApp"
);

fs.writeFileSync('server.ts', server);
console.log("Fixed server.ts");
