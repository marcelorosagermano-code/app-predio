const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url) {
  console.log("No URL");
  process.exit(1);
}

fetch(url + '/rest/v1/', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(r => r.json()).then(data => {
  const rpcs = Object.keys(data.paths).filter(p => p.includes('transfer_sindicancia'));
  console.log("Found RPCs:", rpcs);
  rpcs.forEach(rpc => {
    console.log("RPC:", rpc);
    console.log(JSON.stringify(data.paths[rpc], null, 2));
  });
}).catch(console.error);
