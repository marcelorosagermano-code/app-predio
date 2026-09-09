import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').ilike('full_name', '%Ciro%');
  if (profiles && profiles.length > 0) {
    const { data: residents } = await supabaseAdmin.from('unit_residents').select('*, profiles(*)').eq('profile_id', profiles[0].id);
    console.log(JSON.stringify(residents, null, 2));
  }
}
check();
