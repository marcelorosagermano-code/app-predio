import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id');
  const profileIds = new Set(profiles.map(p => p.id));

  const ghosts = authUsers.users.filter(u => u.email?.startsWith('morador.ap') && !profileIds.has(u.id));
  console.log(JSON.stringify(ghosts.map(u => ({ id: u.id, email: u.email })), null, 2));

  for (const ghost of ghosts) {
    await supabaseAdmin.auth.admin.deleteUser(ghost.id);
    console.log("Deleted ghost:", ghost.email);
  }
}
check();
