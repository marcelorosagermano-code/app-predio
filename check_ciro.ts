import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log("--- PROFILES ---");
  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').ilike('full_name', '%Ciro%');
  console.log(JSON.stringify(profiles, null, 2));

  console.log("\n--- AUTH USERS ---");
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const ciroUsers = users?.users.filter(u => u.user_metadata?.full_name?.includes('Ciro') || u.email?.includes('ciro'));
  console.log(JSON.stringify(ciroUsers, null, 2));

  console.log("\n--- UNIT RESIDENTS ---");
  if (profiles && profiles.length > 0) {
    const { data: residents } = await supabaseAdmin.from('unit_residents').select('*').eq('profile_id', profiles[0].id);
    console.log(JSON.stringify(residents, null, 2));
  }
}
check();
