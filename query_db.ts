import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').ilike('full_name', '%Ciro%');
  console.log("PROFILES FOR CIRO:", JSON.stringify(data, null, 2));

  // Let's also check Auth Users with that email
  const { data: users, error: err } = await supabaseAdmin.auth.admin.listUsers();
  const ciroUser = users?.users.filter(u => u.user_metadata?.full_name?.includes('Ciro'));
  console.log("AUTH USERS FOR CIRO:", JSON.stringify(ciroUser, null, 2));
}

check();
