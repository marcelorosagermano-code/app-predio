const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseAdmin = createClient(url, key);

async function run() {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const admin = users.users.find(u => u.email === 'marcelorosa.germano@gmail.com');
  if (admin) {
    await supabaseAdmin.auth.admin.updateUserById(admin.id, { password: 'password123' });
    console.log("Password updated");
  }
}
run();
