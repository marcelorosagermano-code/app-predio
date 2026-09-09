import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data } = await supabaseAdmin.from('unit_residents').select('*').eq('unit_id', 'e03b7ba9-267b-4840-9142-f7207778ec81');
  console.log(JSON.stringify(data.map(r => ({ id: r.id, profile_id: r.profile_id, email: r.email })), null, 2));
}
check();
