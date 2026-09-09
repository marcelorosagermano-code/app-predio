import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data } = await supabaseAdmin.from('condominiums').select('*').eq('id', '37893a96-91f5-4d99-93fd-aba6a9964d10');
  console.log(JSON.stringify(data, null, 2));
}
check();
