require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const client = createClient(supabaseUrl, supabaseKey);
  
  const res = await client.auth.signInWithPassword({ email: 'fake@example.com', password: 'wrongpassword' });
  console.log("Error:", res.error?.message);
  console.log("Data is null?:", res.data === null);
  console.log("Data:", res.data);
}
test();
