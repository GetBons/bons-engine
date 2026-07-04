// debug-upload.js — test media upload and show raw job status responses
require('dotenv').config();

const KEY          = process.env.PUBLER_API_KEY;
const WORKSPACE_ID = process.env.PUBLER_WORKSPACE_ID;
const BASE         = 'https://app.publer.com/api/v1';

const HEADERS = {
  'Authorization':       `Bearer-API ${KEY}`,
  'Content-Type':        'application/json',
  'Publer-Workspace-Id': WORKSPACE_ID,
};

async function pub(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${BASE}${endpoint}`, opts);
  const text = await res.text();
  if (text.trimStart().startsWith('<!')) throw new Error(`HTML from ${endpoint} (${res.status})`);
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: { raw: text } }; }
}

// Use a tiny test image so the upload is fast
const TEST_IMAGE = 'https://picsum.photos/200/300.jpg';

async function main() {
  console.log('\n🔍 Testing Publer media upload...\n');

  // 1. Submit upload
  const { status: s1, data: d1 } = await pub('/media/from-url', 'POST', {
    media: [{ url: TEST_IMAGE, name: 'debug-test.jpg' }],
    type:  'single',
  });
  console.log(`[${s1}] POST /media/from-url`);
  console.log(JSON.stringify(d1, null, 2));

  const jobId = d1.job_id;
  if (!jobId) { console.log('\n❌ No job_id returned'); return; }

  // 2. Poll job status 5 times, showing full response each time
  console.log(`\n📊 Polling job ${jobId} (5 polls × 3s)...\n`);
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const { status: s2, data: d2 } = await pub(`/job_status/${jobId}`);
    console.log(`[Poll ${i+1}] status=${s2}`);
    console.log(JSON.stringify(d2, null, 2));
    console.log('---');
    const st = d2?.data?.status || d2?.status || d2?.state;
    if (st === 'complete' || st === 'failed') break;
  }
}

main().catch(console.error);
