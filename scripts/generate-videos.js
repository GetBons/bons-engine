// generate-videos.js
// Submits all 7 AI-avatar scripts to HeyGen Avatar IV and waits for render completion.
// Avatar IV produces a moving, expressive avatar (not a static talking head).
// Run directly: node scripts/generate-videos.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const HEYGEN_API_KEY  = process.env.HEYGEN_API_KEY;
const HEYGEN_VOICE_ID = process.env.HEYGEN_VOICE_ID || 'TYsaKjytlhBgNFyzhioU';
// Avatar IV image key — Bons Stylist photo uploaded to HeyGen.
// To regenerate: run node scripts/upload-avatar-photo.js
const HEYGEN_IMAGE_KEY = process.env.HEYGEN_IMAGE_KEY;

const HEYGEN_BASE = 'https://api.heygen.com';
const POLL_INTERVAL_MS = 20000; // check every 20 seconds
const MAX_POLLS = 60;           // give up after 20 minutes per video

// Motion prompt guides Avatar IV gestures and expressions
const MOTION_PROMPT = 'Natural, expressive talking with warm, confident energy. Subtle hand gestures. Occasional eye contact with camera.';

async function submitVideo(script, title) {
  if (!HEYGEN_IMAGE_KEY) {
    throw new Error('HEYGEN_IMAGE_KEY not set in .env — run node scripts/upload-avatar-photo.js first.');
  }

  const res = await fetch(`${HEYGEN_BASE}/v2/video/av4/generate`, {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_key: HEYGEN_IMAGE_KEY,
      video_title: title,
      script,
      voice_id: HEYGEN_VOICE_ID,
      width: 576,
      height: 1024,
      custom_motion_prompt: MOTION_PROMPT,
      enhance_custom_motion_prompt: true,
    }),
  });

  const data = await res.json();
  if (!data.data?.video_id) {
    throw new Error(`HeyGen Avatar IV submit failed: ${JSON.stringify(data)}`);
  }
  return data.data.video_id;
}

async function pollVideo(videoId) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': HEYGEN_API_KEY },
    });
    const data = await res.json();
    const status = data.data?.status;

    if (status === 'completed') {
      return data.data.video_url;
    }
    if (status === 'failed') {
      throw new Error(`HeyGen render failed for ${videoId}: ${JSON.stringify(data)}`);
    }

    const elapsed = Math.round(((i + 1) * POLL_INTERVAL_MS) / 1000);
    process.stdout.write(`\r    ⏳ ${status} — ${elapsed}s elapsed...`);
  }
  throw new Error(`Timed out waiting for video ${videoId}`);
}

async function main() {
  if (!HEYGEN_API_KEY || HEYGEN_API_KEY === 'YOUR_HEYGEN_API_KEY') {
    console.error('❌ HEYGEN_API_KEY not set in .env');
    process.exit(1);
  }
  if (!HEYGEN_IMAGE_KEY) {
    console.error('❌ HEYGEN_IMAGE_KEY not set in .env — run node scripts/upload-avatar-photo.js first.');
    process.exit(1);
  }

  const week = getWeekString();
  const scriptsPath = path.join(__dirname, `../scripts/scripts-${week}.json`);

  if (!fs.existsSync(scriptsPath)) {
    console.error(`❌ No scripts found for ${week}. Run generate-scripts.js first.`);
    process.exit(1);
  }

  const allScripts = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));
  const aiScripts = allScripts.filter(s => s.type === 'ai-avatar'); // all 7

  console.log(`\n🎥 BONS VIDEO GENERATOR (Avatar IV) — ${week}`);
  console.log('━'.repeat(40));
  console.log(`Submitting ${aiScripts.length} scripts to HeyGen Avatar IV...\n`);

  const videos = [];

  // Submit all videos first
  for (const s of aiScripts) {
    console.log(`  [${s.index}/${aiScripts.length}] Submitting "${s.pillar}"...`);
    try {
      const videoId = await submitVideo(s.script, `Bons-${week}-${s.index}-${s.pillar.replace(/\s+/g, '-')}`);
      console.log(`         ✅ Queued: ${videoId}`);
      videos.push({ ...s, videoId, videoUrl: null, status: 'processing' });
    } catch (e) {
      console.error(`         ❌ Submit failed: ${e.message}`);
      videos.push({ ...s, videoId: null, videoUrl: null, status: 'failed', error: e.message });
    }
  }

  // Poll for completion
  console.log('\n⏳ Waiting for HeyGen to render videos (Avatar IV takes 5-15 min each)...\n');
  for (const v of videos.filter(v => v.videoId)) {
    console.log(`  Rendering: ${v.pillar} [${v.videoId}]`);
    try {
      v.videoUrl = await pollVideo(v.videoId);
      v.status = 'completed';
      console.log(`\n  ✅ Ready: ${v.videoUrl}`);
    } catch (e) {
      v.status = 'failed';
      v.error = e.message;
      console.error(`\n  ❌ ${e.message}`);
    }
  }

  // Save results
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `videos-${week}.json`);
  fs.writeFileSync(logPath, JSON.stringify(videos, null, 2));

  const completed = videos.filter(v => v.status === 'completed').length;
  const failed = videos.filter(v => v.status === 'failed').length;

  console.log(`\n✅ Videos logged to logs/videos-${week}.json`);
  console.log(`   ${completed} ready, ${failed} failed\n`);

  return videos;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
