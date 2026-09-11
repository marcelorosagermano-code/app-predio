const res = {
  status: 500,
  ok: false,
  text: async () => '{"success":false,"error":"Cannot read properties of undefined (reading \'session\')"}'
};

async function test() {
  const text = await res.text();
  console.log(text);
  const json = JSON.parse(text);
  console.log(json);
}
test();
