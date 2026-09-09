import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
/const residentEmail = \`morador\.ap\$\{sanitizedNum\}\.\$\{condominiumId\.slice\(0, 8\)\}\@condominio\.app\`;/g,
"const residentEmail = `${requestedRole}.ap${sanitizedNum}.${condominiumId.slice(0, 8)}@condominio.app`;"
);

fs.writeFileSync('server.ts', content);
