import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  const ciroUsers = data.users.filter(u => u.email?.includes('ap103'));
  console.log(JSON.stringify(ciroUsers.map(u => ({ id: u.id, email: u.email })), null, 2));
}
check();
