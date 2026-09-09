import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data } = await supabaseAdmin.from('condominiums').select('*').limit(1);
  console.log("Admin query:", data ? "Success" : "Failed");

  // Create an anonymous client
  const supabaseAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
  const { data: anonData, error: anonErr } = await supabaseAnon.from('condominiums').select('*').limit(1);
  console.log("Anon query:", anonData ? "Success" : "Failed", anonErr);
}
check();
