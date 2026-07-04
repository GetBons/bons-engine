// schedule-youtube.js
// Schedules YouTube Shorts only — use when YouTube was skipped in schedule-posts.js.
// Run: node scripts/schedule-youtube.js [week]
// Example: node scripts/schedule-youtube.js 2026-w27

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const PUBLER_API_KEY  = process.env.PUBLER_API_KEY;
const WORKSPACE_ID    = process.env.PUBLER_WORKSPACE_ID;
const YOUTUBE_ID      = process.env.PUBLER_YOUTUBE_ID;
const PUBLER_BASE     = 'https://app.publer.com/api/v1';

const HEADERS = {
  'Authorization':       `Bearer-API ${PUBLER_API_KEY}`,
  'Content-Type':        'application/json',
  'Publer-Workspace-Id': WORKSPACE_ID,
};

const POST_TIMES = ['09:00', '15:00', '09:00', '15:00', '09:00', '11:00', '15:00'];

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

function getPostingDates(week) {
  // If a schedule log exists for this week, use those exact dates (ensures alignment with other platforms)
  const logPath = path.join(__dirname, `../logs/schedule-${week}.json`);
  if (fs.existsSync(logPath)) {
    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    const dates = log.map(r => r.date).filter(Boolean);
    if (dates.length === 7) return dates;
  }
  // Fallback: next Monday from today (same logic as schedule-posts.js)
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
  const body = script.length > 220 ? script.substring(0, 217) + '...' : script;
  return `${body}\n\nJoin our waitlist → getbons.com\n\n#Shorts #fashion #wardrobe #styleapp #bons #ootd`;
}

async function main() {
  if (!YOUTUBE_ID)   { console.error('❌ PUBLER_YOUTUBE_ID not set');   process.exit(1); }
  if (!WORKSPACE_ID) { console.error('❌ PUBLER_WORKSPACE_ID not set'); process.exit(1); }

  const week       = process.argv[2] || getWeekString();
  const videosPath = path.join(__dirname, `../logs/videos-${week}.json`);

  if (!fs.existsSync(videosPath)) {
    console.error(`❌ No videos for ${week}. Run generate-videos.js first.`);
    process.exit(1);
  }

  const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
  const dates  = getPostingDates(week);

  console.log(`\n▶️  YOUTUBE SCHEDULER — ${week}${process.argv[2] ? ' (manual)' : ''}`);
  console.log('━'.repeat(40));
  console.log(`Posting Mon ${dates[0]} through Sun ${dates[6]}\n`);

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const date  = dates[i];
    const time  = POST_TIMES[i];
    const title = video.script.split('.')[0].substring(0, 100);

    console.log(`  [${i + 1}/7] ${date} ${time} — ${video.pillar}`);

    if (!video.videoUrl) {
      console.log(`    ⚠️  Skipping — no video URL\n`);
      continue;
    }

    try {
      const mediaId = await uploadMedia(video.videoUrl, `bons-video-${week}-yt-${i + 1}.mp4`);
      console.log(`    Media ID: ${mediaId}`);

      const { data } = await pub('/posts/schedule', 'POST', {
        bulk: {
          state: 'scheduled',
          posts: [{
            networks: {
              youtube: {
                type:          'video',
                title,
                text:          buildCaption(video.script),
                media:         [{ id: mediaId, type: 'video' }],
                made_for_kids: false,
              },
            },
            accounts: [{ id: YOUTUBE_ID, scheduled_at: `${date}T${time}:00` }],
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

  console.log('✅ Done! Check Publer → Scheduled Posts to verify YouTube Shorts.\n');
}

main().catch(console.error);
