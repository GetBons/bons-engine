// get-publer-ids.js
// ONE-TIME SETUP HELPER
// Run this once to find your Publer profile IDs for TikTok, Instagram, and Pinterest.
// Then copy the IDs into your .env file.
//
// Usage: node scripts/get-publer-ids.js

require('dotenv').config();

const PUBLER_API_KEY = process.env.PUBLER_API_KEY;
const PUBLER_BASE    = 'https://app.publer.com/api/v1';

async function main() {
  if (!PUBLER_API_KEY) {
    console.error('❌ PUBLER_API_KEY not set in .env');
    process.exit(1);
  }

  console.log('\n🔍 Fetching your Publer connected accounts...\n');

  // Try both auth styles — Publer has used both query param and Bearer header
  const authHeaders = {
    'Authorization': `Bearer ${PUBLER_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Get workspaces
  const wsRes  = await fetch(`${PUBLER_BASE}/workspaces`, { headers: authHeaders });
  const wsData = await wsRes.json();

  if (!wsData?.[0]) {
    console.error('❌ Raw response from Publer:');
    console.error(JSON.stringify(wsData, null, 2));
    console.error('\nStatus code:', wsRes.status);
    process.exit(1);
  }

  const workspace = wsData[0];
  console.log(`Workspace: ${workspace.name} (${workspace.id})\n`);

  // Get social profiles
  // Publer stores profiles inside workspace — try a few endpoint patterns
  const endpoints = [
    `${PUBLER_BASE}/workspaces/${workspace.id}/social_profiles`,
    `${PUBLER_BASE}/social_profiles`,
    `${PUBLER_BASE}/profiles`,
  ];

  let profiles = null;
  for (const url of endpoints) {
    const res  = await fetch(url, { headers: authHeaders });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      profiles = data;
      break;
    }
    if (data?.profiles?.length) {
      profiles = data.profiles;
      break;
    }
  }

  if (!profiles) {
    // Fallback: print raw workspace data
    console.log('Raw workspace data:');
    console.log(JSON.stringify(wsData, null, 2));
    console.log('\n⚠️  Could not auto-find profiles. Check the raw data above for account IDs.');
    return;
  }

  console.log('Connected accounts:\n');
  const env = [];

  for (const p of profiles) {
    const platform = (p.type || p.platform || p.provider || '').toLowerCase();
    const name     = p.name || p.username || p.handle || '';
    const id       = p.id || p.profile_id;

    console.log(`  ${platform.padEnd(12)} | ${name.padEnd(20)} | ID: ${id}`);

    if (platform.includes('tiktok'))    env.push(`PUBLER_TIKTOK_ID=${id}`);
    if (platform.includes('instagram')) env.push(`PUBLER_INSTAGRAM_ID=${id}`);
    if (platform.includes('pinterest')) env.push(`PUBLER_PINTEREST_ID=${id}`);
  }

  console.log('\n━'.repeat(50));
  console.log('Add these lines to your .env file:\n');
  if (env.length) {
    env.forEach(line => console.log(`  ${line}`));
  } else {
    console.log('  (Could not auto-detect platform types — check IDs above manually)');
    profiles.forEach(p => console.log(`  # ${JSON.stringify(p).substring(0, 100)}`));
  }
  console.log('');
}

main().catch(console.error);
