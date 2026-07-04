// schedule-posts.js
// Schedules all content across 4 platforms via Publer API v1 (correct endpoints).
// Auth:     Authorization: Bearer-API KEY + Publer-Workspace-Id header
// Media:    POST /media/from-url → poll job → get media ID → attach to post
// Posts:    POST /posts/schedule with bulk.posts structure
// Run:      node scripts/schedule-posts.js

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const PUBLER_API_KEY  = process.env.PUBLER_API_KEY;
const WORKSPACE_ID    = process.env.PUBLER_WORKSPACE_ID;
const PUBLER_BASE     = 'https://app.publer.com/api/v1';

const HEADERS = {
  'Authorization':      `Bearer-API ${PUBLER_API_KEY}`,
  'Content-Type':       'application/json',
  'Publer-Workspace-Id': WORKSPACE_ID,
};

const ACCOUNT_IDS = {
  tiktok:    process.env.PUBLER_TIKTOK_ID,
  instagram: process.env.PUBLER_INSTAGRAM_ID,
  pinterest: process.env.PUBLER_PINTEREST_ID,
  linkedin:  process.env.PUBLER_LINKEDIN_ID,
};

// Optimal posting times (24h, local time)
const POST_TIMES = {
  tiktok:    ['18:00', '19:00', '20:00', '21:00', '12:00', '07:00', '22:00'],
  instagram: ['06:00', '11:00', '14:00', '17:00', '19:00', '08:00', '20:00'],
  linkedin:  ['08:00', '12:00', '08:00', '12:00', '08:00', '10:00', '12:00'],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function addHour(t) {
  const [h, m] = t.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Generic fetch helper — throws on HTML 404 pages
async function pub(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${PUBLER_BASE}${endpoint}`, opts);
  const text = await res.text();
  if (text.trimStart().startsWith('<!')) {
    throw new Error(`HTML response from ${endpoint} (status ${res.status}) — check endpoint`);
  }
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: { raw: text } }; }
}

// Poll a job until complete — returns result payload
async function pollJob(jobId, label = '') {
  for (let i = 0; i < 60; i++) {  // 60 × 5s = 5 min max
    await sleep(5000);
    const { data } = await pub(`/job_status/${jobId}`);

    // Log first 3 responses verbosely to catch response structure issues
    if (i < 3) {
      process.stdout.write(`\n    [poll ${i+1}] ${JSON.stringify(data).substring(0, 200)}\n`);
    }

    // Check all known Publer response shapes
    const status = data?.data?.status   // { data: { status: "complete" } }
      || data?.status                   // { status: "complete" }
      || data?.state                    // { state: "complete" }
      || data?.job_status               // { job_status: "complete" }
      || null;

    const result = data?.data?.result ?? data?.result ?? data?.payload ?? data;

    if (status === 'complete' || status === 'done' || status === 'success') return result;
    if (status === 'failed' || status === 'error') {
      throw new Error(`Job failed [${label}]: ${JSON.stringify(data).substring(0, 150)}`);
    }
    if (i >= 3) process.stdout.write('.');
  }
  throw new Error(`Job timed out: ${jobId} (${label})`);
}

// Upload a media URL to Publer, return Publer media ID
async function uploadMedia(url, name) {
  const { data } = await pub('/media/from-url', 'POST', {
    media: [{ url, name }],
    type:  'single',
  });
  if (!data.job_id) throw new Error(`No job_id for media upload: ${JSON.stringify(data).substring(0, 150)}`);
  process.stdout.write(`    Uploading ${name}...`);
  const result = await pollJob(data.job_id, name);
  process.stdout.write('\n');

  // Try various locations where Publer might put the media ID in the result
  const media = result?.payload?.media?.[0]
    || result?.media?.[0]
    || result?.payload?.[0]
    || result?.[0];

  if (!media?.id) {
    // Log full result so we can debug the structure
    console.log(`    ⚠️  Full upload result: ${JSON.stringify(result).substring(0, 300)}`);
    throw new Error(`Could not extract media ID from upload result`);
  }
  return media.id;
}

// Create a single scheduled post via the bulk endpoint
// Returns job result (or throws on error)
async function schedulePost(networks, accountEntries, label) {
  const { data } = await pub('/posts/schedule', 'POST', {
    bulk: {
      state: 'scheduled',
      posts: [{ networks, accounts: accountEntries }],
    },
  });
  if (!data.job_id) {
    throw new Error(`No job_id for post [${label}]: ${JSON.stringify(data).substring(0, 150)}`);
  }
  const result = await pollJob(data.job_id, label);

  // Check for per-post failures in the payload (Publer returns status:complete even on partial failure)
  const failures = result?.failures || result?.payload?.failures;
  if (failures && Object.keys(failures).length > 0) {
    const msgs = Object.values(failures).flat().map(f => f.message || JSON.stringify(f)).join('; ');
    throw new Error(`Post rejected by platform: ${msgs}`);
  }
  return result;
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

function buildCaption(script, platform) {
  const body = script.length > 200 ? script.substring(0, 197) + '...' : script;
  const cta   = platform === 'pinterest'
    ? 'Join the Bons waitlist at getbons.com'
    : 'Join our waitlist → getbons.com';
  if (platform === 'instagram') return `${body}\n\n${cta}\n\n#style #fashion #wardrobe #ootd #styleapp #bonsapp`;
  if (platform === 'tiktok')    return `${body} ${cta} #bons #styleapp #fashion #wardrobe`;
  return `${body}\n\n${cta}`;
}

async function main() {
  if (!WORKSPACE_ID) {
    console.error('❌ PUBLER_WORKSPACE_ID not set. Run: node scripts/debug-publer.js');
    process.exit(1);
  }

  const week        = getWeekString();
  const videosPath  = path.join(__dirname, `../logs/videos-${week}.json`);
  const imagesPath  = path.join(__dirname, `../logs/images-${week}.json`);
  const linkedInPath = path.join(__dirname, `../scripts/linkedin-${week}.json`);

  if (!fs.existsSync(videosPath)) {
    console.error(`❌ No videos for ${week}. Run generate-videos.js first.`);
    process.exit(1);
  }

  const videos       = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
  const images       = fs.existsSync(imagesPath)    ? JSON.parse(fs.readFileSync(imagesPath, 'utf8'))    : [];
  const linkedInPosts = fs.existsSync(linkedInPath) ? JSON.parse(fs.readFileSync(linkedInPath, 'utf8')) : [];
  const dates        = getPostingDates();

  console.log(`\n📅 BONS SCHEDULER — ${week}`);
  console.log('━'.repeat(40));
  console.log(`Posting Mon ${dates[0]} through Sun ${dates[6]}\n`);

  if (images.length === 0)       console.warn('⚠️  No Pinterest images (run generate-images.js)\n');
  if (linkedInPosts.length === 0) console.warn('⚠️  No LinkedIn posts (run generate-linkedin.js)\n');

  const results = [];

  for (let i = 0; i < videos.length; i++) {
    const video  = videos[i];
    const image  = images[i] || null;
    const liPost = linkedInPosts[i] || null;
    const date   = dates[i];

    console.log(`\n  [${i + 1}/7] ${date} — ${video.pillar}`);
    const result = { index: i + 1, date, pillar: video.pillar };

    if (!video.videoUrl) {
      console.log(`    ⚠️  Skipping — no video URL yet`);
      results.push({ ...result, skipped: true });
      continue;
    }

    // ── Upload video ────────────────────────────────────────────────
    let videoMediaId = null;
    try {
      videoMediaId = await uploadMedia(video.videoUrl, `bons-video-${week}-${i + 1}.mp4`);
      console.log(`    Video media ID: ${videoMediaId}`);
    } catch (e) {
      console.log(`    ❌ Video upload: ${e.message}`);
    }

    // ── Upload image ─────────────────────────────────────────────────
    let imageMediaId = null;
    if (image?.imageUrl) {
      try {
        imageMediaId = await uploadMedia(image.imageUrl, `bons-image-${week}-${i + 1}.jpg`);
        console.log(`    Image media ID: ${imageMediaId}`);
      } catch (e) {
        console.log(`    ❌ Image upload: ${e.message}`);
      }
    }

    // ── TikTok ───────────────────────────────────────────────────────
    if (videoMediaId) {
      const tkTime = `${date}T${POST_TIMES.tiktok[i]}:00`;
      try {
        await schedulePost(
          { tiktok: { type: 'video', text: buildCaption(video.script, 'tiktok'), media: [{ id: videoMediaId, type: 'video' }] } },
          [{ id: ACCOUNT_IDS.tiktok, scheduled_at: tkTime }],
          `TikTok ${date}`
        );
        result.tiktok = `✅ ${POST_TIMES.tiktok[i]}`;
        console.log(`    TikTok  ${POST_TIMES.tiktok[i]}: ✅`);
      } catch (e) {
        result.tiktok = `❌ ${e.message.substring(0, 80)}`;
        console.log(`    TikTok: ❌ ${e.message.substring(0, 80)}`);
      }
    }

    // ── Instagram Reel ───────────────────────────────────────────────
    if (videoMediaId) {
      const igTime = `${date}T${POST_TIMES.instagram[i]}:00`;
      try {
        await schedulePost(
          { instagram: { type: 'video', text: buildCaption(video.script, 'instagram'), media: [{ id: videoMediaId, type: 'video' }] } },
          [{ id: ACCOUNT_IDS.instagram, scheduled_at: igTime }],
          `Instagram ${date}`
        );
        result.instagram = `✅ ${POST_TIMES.instagram[i]}`;
        console.log(`    Instagram ${POST_TIMES.instagram[i]}: ✅`);
      } catch (e) {
        result.instagram = `❌ ${e.message.substring(0, 80)}`;
        console.log(`    Instagram: ❌ ${e.message.substring(0, 80)}`);
      }
    }

    // ── LinkedIn text ────────────────────────────────────────────────
    if (liPost?.linkedInPost && ACCOUNT_IDS.linkedin) {
      const liTime = `${date}T${POST_TIMES.linkedin[i]}:00`;
      try {
        await schedulePost(
          { linkedin: { type: 'status', text: liPost.linkedInPost } },
          [{ id: ACCOUNT_IDS.linkedin, scheduled_at: liTime }],
          `LinkedIn ${date}`
        );
        result.linkedin = `✅ ${POST_TIMES.linkedin[i]}`;
        console.log(`    LinkedIn  ${POST_TIMES.linkedin[i]}: ✅`);
      } catch (e) {
        result.linkedin = `❌ ${e.message.substring(0, 80)}`;
        console.log(`    LinkedIn: ❌ ${e.message.substring(0, 80)}`);
      }
    }

    // ── Pinterest ────────────────────────────────────────────────────
    // NOTE: board_id needs to be verified — Publer may use its own board ID format
    // Run node scripts/get-pinterest-boards.js to get the correct IDs
    if (imageMediaId && ACCOUNT_IDS.pinterest) {
      const pinTime = `${date}T${addHour(POST_TIMES.tiktok[i])}:00`;
      const boardId = process.env[`PUBLER_BOARD_${video.pillar.replace(/\s+/g, '_').toUpperCase()}`]
        || process.env.PUBLER_BOARD_DEFAULT
        || null;

      if (!boardId) {
        result.pinterest = '⚠️  skipped — run get-pinterest-boards.js to set board IDs';
        console.log(`    Pinterest: ⚠️  no board ID set (see get-pinterest-boards.js)`);
      } else {
        try {
          await schedulePost(
            { pinterest: { type: 'photo', text: buildCaption(video.script, 'pinterest'), media: [{ id: imageMediaId, type: 'image' }] } },
            [{ id: ACCOUNT_IDS.pinterest, scheduled_at: pinTime, album_id: boardId }],
            `Pinterest ${date}`
          );
          result.pinterest = `✅ ${addHour(POST_TIMES.tiktok[i])}`;
          console.log(`    Pinterest ${addHour(POST_TIMES.tiktok[i])}: ✅`);
        } catch (e) {
          result.pinterest = `❌ ${e.message.substring(0, 80)}`;
          console.log(`    Pinterest: ❌ ${e.message.substring(0, 80)}`);
        }
      }
    }

    results.push(result);
    await sleep(500);
  }

  const logPath = path.join(__dirname, `../logs/schedule-${week}.json`);
  fs.writeFileSync(logPath, JSON.stringify(results, null, 2));

  const ok      = results.filter(r => !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  console.log(`\n${'━'.repeat(40)}`);
  console.log(`✅ Done! ${ok}/7 days attempted. Log: logs/schedule-${week}.json`);
  if (skipped) console.log(`⚠️  ${skipped} days skipped (no video URL)`);
  console.log('🔍 Verify in Publer dashboard → Scheduled Posts\n');
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
