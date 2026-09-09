import fs from 'fs';

let content = fs.readFileSync('src/services/supabase/authService.ts', 'utf8');

content = content.replace(
`  async createMoradorUser(unitNumber: string, responsibleName: string): Promise<{`,
`  async createMoradorUser(unitNumber: string, responsibleName: string, role: string = 'morador'): Promise<{`
);

content = content.replace(
`          unitNumber: cleanUnit,
          responsibleName: cleanName,
        }),`,
`          unitNumber: cleanUnit,
          responsibleName: cleanName,
          role,
        }),`
);

fs.writeFileSync('src/services/supabase/authService.ts', content);
