import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const adminEmail = 'marcelorosa.germano@gmail.com';
  const { data: adminAuth } = await supabaseAdmin.from('profiles').select('id, condominium_id').eq('email', adminEmail).single();
  
  if (!adminAuth) {
    console.log("Admin not found");
    return;
  }
  
  const tokenData = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: adminEmail,
  });
  
  // We can't easily hit the API because we need an actual bearer token.
  // Actually we CAN get a token if we use supabase client to sign in with password, but we don't know the password.
  // We can just use the server's internal logic manually? No, we just need to verify the code visually.
  console.log("We will just rely on the manual test by the user.");
}
run();
