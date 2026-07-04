// schedule-instagram.js
// Re-schedules Instagram posts only — use when Instagram was skipped or failed.
// Run: node scripts/schedule-instagram.js

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const PUBLER_API_KEY  = process.env.PUBLER_API_KEY;
const WORKSPACE_ID    = process.env.PUBLER_WORKSPACE_ID;
const INSTAGRAM_ID    = process.env.PUBLER_INSTAGRAM_ID;
const PUBLER_BASE     = 'https://app.publer.com/api/v1';

const HEADERS = {
  'Authorization':       `Bearer-API ${PUBLER_API_KEY}`,
  'Content-Type':        'application/json',
  'Publer-Workspace-Id': WORKSPACE_ID,
};

const POST_TIMES = ['06:00', '11:00', '14:00', '17:00', '19:00', '08:00', '20:00'];

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
    const status = data?.data?.status || data?.status || data?.state;
    const result = data?.data?.result ?? data?.result ?? data?.payload ?? data;
    if (status === 'complete' || status === 'done' || status === 'success') {
      const failures = result?.failures || result?.payload?.failures;
      if (failures && Object.keys(failures).length > 0) {
        const msgs = Object.values(failures).flat().map(f => f.message || JSON.stringify(f)).join('; ');
        throw new Error(`Platform rejected: ${msgs}`);
      }
      return result;
    }
    if (status === 'failed' || status === 'error') throw new Error(`Job failed: ${JSON.stringify(data).substring(0, 100)}`);
    process.stdout.write('.');
  }
  throw new Error(`Job timed out: ${jobId}`);
}

async function uploadMedia(url, name) {
  const { data } = await pub('/media/from-url', 'POST', {
    media: [{ url, name }],
    type:  'single',
  });
  if (!data.job_id) throw new Error(`No job_id for media upload`);
  process.stdout.write(`    Uploading ${name}...`);
  const result = await pollJob(data.job_id);
  process.stdout.write('\n');
  const media = result?.payload?.media?.[0] || result?.media?.[0] || result?.payload?.[0] || result?.[0];
  if (!media?.id) throw new Error(`Could not extract media ID: ${JSON.stringify(result).substring(0, 200)}`);
  return media.id;
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

function buildCaption(script) {
  const body = script.length > 200 ? script.substring(0, 197) + '...' : script;
  return `${body}\n\nJoin our waitlist → getbons.com\n\n#style #fashion #wardrobe #ootd #styleapp #bonsapp`;
}

async function main() {
  if (!INSTAGRAM_ID)  { console.error('❌ PUBLER_INSTAGRAM_ID not set');  process.exit(1); }
  if (!WORKSPACE_ID)  { console.error('❌ PUBLER_WORKSPACE_ID not set');  process.exit(1); }

  const week       = getWeekString();
  const videosPath = path.join(__dirname, `../logs/videos-${week}.json`);

  if (!fs.existsSync(videosPath)) {
    console.error(`❌ No videos for ${week}. Run generate-videos.js first.`);
    process.exit(1);
  }

  const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
  const dates  = getPostingDates();

  console.log(`\n📸 INSTAGRAM SCHEDULER — ${week}`);
  console.log('━'.repeat(40));
  console.log(`Posting Mon ${dates[0]} through Sun ${dates[6]}\n`);

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const date  = dates[i];
    const time  = POST_TIMES[i];

    console.log(`  [${i + 1}/7] ${date} ${time} — ${video.pillar}`);

    if (!video.videoUrl) {
      console.log(`    ⚠️  Skipping — no video URL\n`);
      continue;
    }

    try {
      const mediaId = await uploadMedia(video.videoUrl, `bons-video-${week}-ig-${i + 1}.mp4`);
      console.log(`    Media ID: ${mediaId}`);

      const { data } = await pub('/posts/schedule', 'POST', {
        bulk: {
          state: 'scheduled',
          posts: [{
            networks: {
              instagram: {
                type:  'video',   // Reels via Publer use type:'video'
                text:  buildCaption(video.script),
                media: [{ id: mediaId, type: 'video' }],
              },
            },
            accounts: [{ id: INSTAGRAM_ID, scheduled_at: `${date}T${time}:00` }],
          }],
        },
      });

      if (!data.job_id) throw new Error(JSON.stringify(data).substring(0, 100));
      await pollJob(data.job_id);
      console.log(`    ✅ Scheduled ${date} ${time}\n`);
    } catch (e) {
      console.log(`    ❌ ${e.message.substring(0, 100)}\n`);
    }

    await sleep(500);
  }

  console.log('✅ Done! Check Publer → Scheduled Posts to verify Instagram reels.\n');
}

main().catch(console.error);
