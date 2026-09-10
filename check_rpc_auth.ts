import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function check() {
  const { data, error } = await supabaseAnon.rpc('transfer_sindicancia', { caller_id: '00000000-0000-0000-0000-000000000000', target_profile_id: '00000000-0000-0000-0000-000000000000', current_sindico_id: '00000000-0000-0000-0000-000000000000' });
  console.log("Anon Call Error:", error);
}
check();
