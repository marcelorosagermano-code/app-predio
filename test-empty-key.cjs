const { createClient } = require('@supabase/supabase-js');
try {
  const client = createClient('https://example.supabase.co', '');
  console.log("Success");
} catch (e) {
  console.log("Error:", e.message);
}
