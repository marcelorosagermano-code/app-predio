import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').ilike('full_name', '%Ciro%');
  console.log("Profiles:", JSON.stringify(profiles, null, 2));
}
check();
