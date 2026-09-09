import fs from 'fs';
let content = fs.readFileSync('src/services/supabase/authService.ts', 'utf8');

content = content.replace(
`  }

  async deleteMoradorUser`,
`,

  async deleteMoradorUser`
);

fs.writeFileSync('src/services/supabase/authService.ts', content);
