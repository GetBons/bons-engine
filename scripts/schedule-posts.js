// schedule-posts.js
// Schedules all 7 videos + 7 pins to TikTok, Instagram, and Pinterest via Publer.
// Reads from logs/videos-WEEK.json and scripts/pin-descriptions-WEEK.json.
// Run directly: node scripts/schedule-posts.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');
const { getBoardId } = require('./pinterest-board-map');

const PUBLER_API_KEY  = process.env.PUBLER_API_KEY;
const PUBLER_BASE     = 'https://app.publer.com/api/v1';

// Optimal posting times per platform (24h format, local machine time)
const POST_TIMES = {
  tiktok:    ['18:00', '19:00', '20:00', '21:00', '12:00', '07:00', '22:00'],
  instagram: ['06:00', '11:00', '14:00', '17:00', '19:00', '08:00', '20:00'],
  // Pinterest posts 1hr after TikTok to avoid overlap (calculated dynamically below)
};

async function publerPost(body) {
  const res = await fetch(`${PUBLER_BASE}/posts?api_token=${PUBLER_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

async function getProfileIds() {
  // Auto-discover Publer profile IDs by platform type
  const res = await fetch(`${PUBLER_BASE}/workspaces?api_token=${PUBLER_API_KEY}`);
  const workspaces = await res.json();

  // Use env vars if set, otherwise fall back to auto-discovery
  const ids = {
    tiktok:    process.env.PUBLER_TIKTOK_ID    || null,
    instagram: process.env.PUBLER_INSTAGRAM_ID  || null,
    pinterest: process.env.PUBLER_PINTEREST_ID  || null,
  };

  if (ids.tiktok && ids.instagram && ids.pinterest) return ids;

  // Try to fetch profiles from workspace
  const workspaceId = workspaces[0]?.id;
  if (workspaceId) {
    console.log('  ⚠️  Profile IDs not in .env — run get-publer-ids.js to find them.');
  }

  return ids;
}

function getPostingDates() {
  // Start posting Monday of the upcoming week (7 days, Mon-Sun)
  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMonday);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
  }
  return dates;
}

function addHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildCaption(script, pillar, platform) {
  const cta = platform === 'pinterest'
    ? 'Join the Bons waitlist at getbons.com'
    : 'Join our waitlist → getbons.com';

  const body = script.length > 200 ? script.substring(0, 197) + '...' : script;

  if (platform === 'instagram') {
    return `${body}\n\n${cta}\n\n#style #fashion #wardrobe #ootd #styleapp #bonsapp`;
  }
  if (platform === 'tiktok') {
    return `${body} ${cta} #bons #styleapp #fashion #wardrobe`;
  }
  // Pinterest uses the full SEO description (passed separately)
  return body;
}

async function main() {
  const week = getWeekString();

  const videosPath = path.join(__dirname, `../logs/videos-${week}.json`);
  const pinsPath   = path.join(__dirname, `../scripts/pin-descriptions-${week}.json`);

  if (!fs.existsSync(videosPath)) {
    console.error(`❌ No videos for ${week}. Run generate-videos.js first.`);
    process.exit(1);
  }

  const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
  const pins   = fs.existsSync(pinsPath)
    ? JSON.parse(fs.readFileSync(pinsPath, 'utf8'))
    : videos;

  console.log(`\n📅 BONS SCHEDULER — ${week}`);
  console.log('━'.repeat(40));

  const profileIds = await getProfileIds();

  if (!profileIds.tiktok || !profileIds.instagram || !profileIds.pinterest) {
    console.error('\n❌ Missing Publer profile IDs. Run: node scripts/get-publer-ids.js');
    console.error('   Then add the IDs to your .env file and re-run.\n');
    process.exit(1);
  }

  const dates = getPostingDates();
  console.log(`\nPosting Mon ${dates[0]} through Sun ${dates[6]}\n`);

  const results = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const pin   = pins[i] || video;
    const date  = dates[i];

    if (!video.videoUrl) {
      console.log(`  [${i + 1}/7] ⚠️  Skipping ${video.pillar} — no video URL yet`);
      results.push({ index: i + 1, pillar: video.pillar, skipped: true, reason: 'no video URL' });
      continue;
    }

    console.log(`\n  [${i + 1}/7] ${date} — ${video.pillar}`);

    const tkTime  = `${date}T${POST_TIMES.tiktok[i]}:00`;
    const igTime  = `${date}T${POST_TIMES.instagram[i]}:00`;
    const pinTime = `${date}T${addHour(POST_TIMES.tiktok[i])}:00`;

    const result = { index: i + 1, date, pillar: video.pillar };

    // --- TikTok ---
    const tkBody = {
      profile_ids: [profileIds.tiktok],
      text: buildCaption(video.script, video.pillar, 'tiktok'),
      scheduled_at: tkTime,
      media_urls: [video.videoUrl],
    };
    const tkRes = await publerPost(tkBody);
    result.tiktok = tkRes?.post?.id ? `✅ ${tkRes.post.id}` : `⚠️  ${JSON.stringify(tkRes).substring(0, 80)}`;
    console.log(`    TikTok ${POST_TIMES.tiktok[i]}: ${result.tiktok}`);

    // --- Instagram ---
    const igBody = {
      profile_ids: [profileIds.instagram],
      text: buildCaption(video.script, video.pillar, 'instagram'),
      scheduled_at: igTime,
      media_urls: [video.videoUrl],
    };
    const igRes = await publerPost(igBody);
    result.instagram = igRes?.post?.id ? `✅ ${igRes.post.id}` : `⚠️  ${JSON.stringify(igRes).substring(0, 80)}`;
    console.log(`    Instagram ${POST_TIMES.instagram[i]}: ${result.instagram}`);

    // --- Pinterest ---
    const boardId = getBoardId(video.pillar);
    const pinBody = {
      profile_ids: [profileIds.pinterest],
      text: pin.pinDescription || buildCaption(video.script, video.pillar, 'pinterest'),
      scheduled_at: pinTime,
      media_urls: [video.videoUrl],
      pinterest_board_id: boardId,
    };
    const pinRes = await publerPost(pinBody);
    result.pinterest = pinRes?.post?.id ? `✅ ${pinRes.post.id}` : `⚠️  ${JSON.stringify(pinRes).substring(0, 80)}`;
    console.log(`    Pinterest ${addHour(POST_TIMES.tiktok[i])} → ${boardId}: ${result.pinterest}`);

    results.push(result);

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 500));
  }

  // Save schedule log
  const logDir = path.join(__dirname, '../logs');
  const logPath = path.join(logDir, `schedule-${week}.json`);
  fs.writeFileSync(logPath, JSON.stringify(results, null, 2));

  const posted   = results.filter(r => !r.skipped).length;
  const skipped  = results.filter(r => r.skipped).length;

  console.log(`\n${'━'.repeat(40)}`);
  console.log(`✅ Done! ${posted * 3} posts scheduled across TikTok, Instagram & Pinterest.`);
  if (skipped) console.log(`⚠️  ${skipped} videos skipped (missing URLs — check logs/videos-${week}.json)`);
  console.log(`📋 Full log: logs/schedule-${week}.json`);
  console.log('🔍 Verify in Publer dashboard → Scheduled Posts\n');
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
