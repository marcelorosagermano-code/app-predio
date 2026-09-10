import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
async function check() {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: 'SELECT 1;' });
  console.log("exec_sql RPC check:", { data, error });
}
check();
