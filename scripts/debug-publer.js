// debug-publer.js — tests correct Publer API auth and gets workspace ID
// node scripts/debug-publer.js

require('dotenv').config();
const KEY = process.env.PUBLER_API_KEY;
const BASE = 'https://app.publer.com/api/v1';

const AUTH_HEADERS = {
  'Authorization': `Bearer-API ${KEY}`,
  'Content-Type': 'application/json',
};

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: AUTH_HEADERS });
  const text = await res.text();
  const preview = text.startsWith('<!') ? '[HTML page]' : text.substring(0, 500);
  console.log(`\n[${res.status}] GET ${path}`);
  console.log(preview);
  try { return JSON.parse(text); } catch { return null; }
}

async function main() {
  console.log(`\nPubler API Debug — key: ...${KEY.slice(-8)}\n`);

  // Test workspaces with correct Bearer-API auth
  const ws = await get('/workspaces');

  if (!ws?.[0]) {
    console.log('\n❌ Still failing — check API key in Publer settings.');
    return;
  }

  const workspace = ws[0];
  console.log(`\n✅ Workspace found:`);
  console.log(`   ID:   ${workspace.id}`);
  console.log(`   Name: ${workspace.name}`);
  console.log(`\nAdd this to your .env:\n   PUBLER_WORKSPACE_ID=${workspace.id}`);

  // Also get accounts to verify IDs
  const WORKSPACE_ID = workspace.id;
  const res = await fetch(`${BASE}/accounts`, {
    headers: { ...AUTH_HEADERS, 'Publer-Workspace-Id': WORKSPACE_ID },
  });
  const text = await res.text();
  console.log(`\n[${res.status}] GET /accounts`);
  console.log(text.startsWith('<!') ? '[HTML page]' : text.substring(0, 800));
}

main().catch(console.error);
