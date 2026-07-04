// schedule-linkedin.js
// Schedules LinkedIn posts only — use when LinkedIn was skipped in schedule-posts.js.
// Uses correct Publer API: Bearer-API auth + /posts/schedule endpoint.
// Run: node scripts/schedule-linkedin.js

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const PUBLER_API_KEY  = process.env.PUBLER_API_KEY;
const WORKSPACE_ID    = process.env.PUBLER_WORKSPACE_ID;
const LINKEDIN_ID     = process.env.PUBLER_LINKEDIN_ID;
const PUBLER_BASE     = 'https://app.publer.com/api/v1';

const HEADERS = {
  'Authorization':       `Bearer-API ${PUBLER_API_KEY}`,
  'Content-Type':        'application/json',
  'Publer-Workspace-Id': WORKSPACE_ID,
};

const POST_TIMES = ['08:00', '12:00', '08:00', '12:00', '08:00', '10:00', '12:00'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pub(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${PUBLER_BASE}${endpoint}`, opts);
  const text = await res.text();
  if (text.trimStart().startsWith('<!')) throw new Error(`HTML response from ${endpoint}`);
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: { raw: text } }; }
}

async function pollJob(jobId) {
  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    const { data } = await pub(`/job_status/${jobId}`);
    const status = data?.data?.status;
    if (status === 'complete') return data.data.result;
    if (status === 'failed')   throw new Error(`Job failed: ${JSON.stringify(data).substring(0, 100)}`);
    process.stdout.write('.');
  }
  throw new Error(`Job timed out: ${jobId}`);
}

function getPostingDates() {
  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

async function main() {
  if (!LINKEDIN_ID)  { console.error('❌ PUBLER_LINKEDIN_ID not set');  process.exit(1); }
  if (!WORKSPACE_ID) { console.error('❌ PUBLER_WORKSPACE_ID not set'); process.exit(1); }

  const week        = getWeekString();
  const linkedInPath = path.join(__dirname, `../scripts/linkedin-${week}.json`);

  if (!fs.existsSync(linkedInPath)) {
    console.error(`❌ No LinkedIn posts for ${week}. Run generate-linkedin.js first.`);
    process.exit(1);
  }

  const posts = JSON.parse(fs.readFileSync(linkedInPath, 'utf8'));
  const dates = getPostingDates();

  console.log(`\n💼 LINKEDIN SCHEDULER — ${week}`);
  console.log('━'.repeat(40));
  console.log(`Posting Mon ${dates[0]} through Sun ${dates[6]}\n`);

  for (let i = 0; i < posts.length; i++) {
    const p    = posts[i];
    const date = dates[i];
    const time = POST_TIMES[i];

    process.stdout.write(`  [${i + 1}/7] ${date} ${time} — ${p.pillar}...`);

    try {
      const { data } = await pub('/posts/schedule', 'POST', {
        bulk: {
          state: 'scheduled',
          posts: [{
            networks: { linkedin: { type: 'status', text: p.linkedInPost } },
            accounts: [{ id: LINKEDIN_ID, scheduled_at: `${date}T${time}:00` }],
          }],
        },
      });

      if (!data.job_id) throw new Error(JSON.stringify(data).substring(0, 100));
      await pollJob(data.job_id);
      console.log(' ✅');
    } catch (e) {
      console.log(` ❌ ${e.message.substring(0, 80)}`);
    }

    await sleep(500);
  }

  console.log('\n✅ Done! Check Publer → Scheduled Posts to verify.\n');
}

main().catch(console.error);
