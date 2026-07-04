// get-pinterest-boards.js
// Fetches Pinterest board IDs from Publer so we can map them to content pillars.
// Run: node scripts/get-pinterest-boards.js

require('dotenv').config();

const KEY          = process.env.PUBLER_API_KEY;
const WORKSPACE_ID = process.env.PUBLER_WORKSPACE_ID;
const PINTEREST_ID = process.env.PUBLER_PINTEREST_ID;
const BASE         = 'https://app.publer.com/api/v1';

const HEADERS = {
  'Authorization':       `Bearer-API ${KEY}`,
  'Content-Type':        'application/json',
  'Publer-Workspace-Id': WORKSPACE_ID,
};

async function main() {
  console.log('\n📌 Fetching Pinterest boards from Publer...\n');

  // Try accounts/{id}/boards or similar
  const endpoints = [
    `/accounts/${PINTEREST_ID}/boards`,
    `/accounts/${PINTEREST_ID}`,
    `/accounts?provider=pinterest`,
  ];

  for (const ep of endpoints) {
    const res  = await fetch(`${BASE}${ep}`, { headers: HEADERS });
    const text = await res.text();
    const preview = text.startsWith('<!') ? '[HTML page]' : text.substring(0, 800);
    console.log(`[${res.status}] GET ${ep}`);
    console.log(preview);
    console.log('');
  }

  console.log(`\nTip: Add board IDs to .env like:`);
  console.log(`  PUBLER_BOARD_OUTFIT_INSPIRATION=<board_id>`);
  console.log(`  PUBLER_BOARD_FASHION_TECH=<board_id>`);
  console.log(`  PUBLER_BOARD_CLOSET_ORGANIZATION=<board_id>`);
  console.log(`  PUBLER_BOARD_CAPSULE_WARDROBE=<board_id>`);
  console.log(`  PUBLER_BOARD_BEHIND_THE_SCENES=<board_id>`);
  console.log(`  PUBLER_BOARD_DEFAULT=<fallback_board_id>\n`);
}

main().catch(console.error);
