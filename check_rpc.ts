import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabaseAdmin.rpc('transfer_sindicancia', { caller_id: '00000000-0000-0000-0000-000000000000', target_profile_id: '00000000-0000-0000-0000-000000000000', current_sindico_id: '00000000-0000-0000-0000-000000000000' });
  console.log("RPC Error:", error);
  console.log("RPC Data:", data);
}
check();
