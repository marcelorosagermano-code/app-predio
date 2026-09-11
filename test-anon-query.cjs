const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
// Simulating the backend fallback to ANON key
const supabaseAdmin = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  const { data, error } = await supabaseAdmin.from('profiles').select('id').limit(2);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
