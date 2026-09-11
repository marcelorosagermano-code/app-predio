const fs = require('fs');

let authTs = fs.readFileSync('src/services/supabase/authService.ts', 'utf8');

authTs = authTs.replace(/  async listCondominiumUsers\(/g, "  async listCondominiumUsers(");
authTs = authTs.replace(/  async createMoradorUser\(/g, "  createMoradorUser: async function(");
authTs = authTs.replace(/  async updateMoradorUser\(/g, "  updateMoradorUser: async function(");
authTs = authTs.replace(/  async deleteMoradorUser\(/g, "  deleteMoradorUser: async function(");
authTs = authTs.replace(/  async transferSindicancia\(/g, "  transferSindicancia: async function(");
authTs = authTs.replace(/  async listCondominiumUsers\(/g, "  listCondominiumUsers: async function(");

// add commas at the end of each method.
authTs = authTs.replace(/  \}\n\n  createMoradorUser/g, "  },\n\n  createMoradorUser");
authTs = authTs.replace(/  \}\n\n  updateMoradorUser/g, "  },\n\n  updateMoradorUser");
authTs = authTs.replace(/  \}\n\n  deleteMoradorUser/g, "  },\n\n  deleteMoradorUser");
authTs = authTs.replace(/  \}\n\n  transferSindicancia/g, "  },\n\n  transferSindicancia");
authTs = authTs.replace(/  \}\n\}\n\nexport const authService = new AuthService\(\);/g, "  }\n};\n");

fs.writeFileSync('src/services/supabase/authService.ts', authTs);
console.log("Fixed obj!");
