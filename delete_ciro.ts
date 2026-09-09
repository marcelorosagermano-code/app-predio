import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function clean() {
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email').ilike('full_name', '%Ciro%');
  if (profiles) {
    for (const p of profiles) {
      await supabaseAdmin.from('unit_residents').delete().eq('profile_id', p.id);
      await supabaseAdmin.from('profiles').delete().eq('id', p.id);
      await supabaseAdmin.auth.admin.deleteUser(p.id);
      console.log('Deleted', p.email);
    }
  }
}

clean();
