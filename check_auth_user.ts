import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data } = await supabaseAdmin.auth.admin.getUserById('405700da-80ce-4310-aeb9-1028d86745ad');
  console.log(JSON.stringify(data.user?.user_metadata, null, 2));
}
check();
