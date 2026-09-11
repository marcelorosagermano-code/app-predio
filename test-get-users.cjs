const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const authClient = createClient(url, key);

async function run() {
  const { data, error } = await authClient.auth.signInWithPassword({
    email: 'marcelorosa.germano@gmail.com',
    password: 'password123'
  });
  if (error || !data.session) {
    console.log("Login failed", error);
    return;
  }
  const token = data.session.access_token;
  
  const res = await fetch('http://localhost:3000/api/admin/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const body = await res.text();
  console.log("Response:", res.status, body);
}
run();
