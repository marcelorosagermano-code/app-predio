import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function deleteGhost() {
  const ghostId = '99da12ae-0fd5-4ccb-9397-a55966fb608b';
  const { error } = await supabaseAdmin.auth.admin.deleteUser(ghostId);
  console.log("Deleted ghost user:", error || "Success");
}
deleteGhost();
