import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data } = await supabaseAdmin.from('profiles').select('*').in('id', ['405700da-80ce-4310-aeb9-1028d86745ad', '99da12ae-0fd5-4ccb-9397-a55966fb608b']);
  console.log(JSON.stringify(data.map(p => ({ id: p.id, role: p.role })), null, 2));
}
check();
