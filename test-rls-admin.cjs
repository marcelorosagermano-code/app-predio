const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

async function run() {
  const authClient = createClient(url, key);
  const { data: auth } = await authClient.auth.signInWithPassword({
    email: 'marcelorosa.germano@gmail.com',
    password: 'password123'
  });
  const token = auth.session.access_token;

  const userClient = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data, error } = await userClient.from('profiles').select('id, full_name, email, role');
  console.log("Error:", error);
  console.log("Profiles count:", data ? data.length : 0);
}
run();
