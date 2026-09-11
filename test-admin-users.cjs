const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      role,
      is_active,
      created_at,
      unit_residents (
        is_primary,
        units (
          unit_number
        )
      )
    `).limit(2);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}
test();
