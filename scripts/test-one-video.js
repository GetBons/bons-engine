// test-one-video.js
// Generates a single test video using HeyGen Avatar IV to check quality.
// Run: node scripts/test-one-video.js

require('dotenv').config();

const HEYGEN_API_KEY  = process.env.HEYGEN_API_KEY;
const HEYGEN_VOICE_ID = process.env.HEYGEN_VOICE_ID || 'TYsaKjytlhBgNFyzhioU';
const HEYGEN_IMAGE_KEY = process.env.HEYGEN_IMAGE_KEY;
const HEYGEN_BASE     = 'https://api.heygen.com';
const POLL_INTERVAL_MS = 15000;
const MAX_POLLS = 40;

const TEST_SCRIPT = `Standing in front of a full closet with nothing to wear isn't a you problem — it's a system problem. Most wardrobes aren't missing clothes. They're missing logic.

That's what we built Bons to solve. It photographs your closet, learns what you own, and builds outfits you'd never think to put together yourself. No shopping required. No stylist needed. Just the clothes already hanging in your closet, finally working for you.

We're not live yet — but your spot on the waitlist is open right now at getbons.com.`;

async function main() {
  if (!HEYGEN_IMAGE_KEY) {
    console.error('❌ HEYGEN_IMAGE_KEY not set in .env');
    console.error('   Run node scripts/upload-avatar-photo.js to generate it.');
    process.exit(1);
  }

  console.log('\n🧪 BONS VIDEO TEST — Avatar IV');
  console.log('━'.repeat(40));
  console.log('Submitting test video to HeyGen Avatar IV...\n');

  const res = await fetch(`${HEYGEN_BASE}/v2/video/av4/generate`, {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_key: HEYGEN_IMAGE_KEY,
      video_title: 'Bons-TEST-avatar-iv',
      script: TEST_SCRIPT,
      voice_id: HEYGEN_VOICE_ID,
      width: 576,
      height: 1024,
      custom_motion_prompt: 'Natural, expressive talking with warm, confident energy. Subtle hand gestures. Occasional eye contact with camera.',
      enhance_custom_motion_prompt: true,
    }),
  });

  const data = await res.json();
  if (!data.data?.video_id) {
    console.error('❌ Submit failed:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const videoId = data.data.video_id;
  console.log(`✅ Queued: ${videoId}`);
  console.log('⏳ Waiting for render (Avatar IV takes 3-8 min)...\n');

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const poll = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': HEYGEN_API_KEY },
    });
    const pollData = await poll.json();
    const status = pollData.data?.status;
    const elapsed = Math.round(((i + 1) * POLL_INTERVAL_MS) / 1000);

    if (status === 'completed') {
      console.log(`\n✅ Done! Video URL:\n`);
      console.log(pollData.data.video_url);
      console.log('\nOpen that link in your browser to review.\n');
      return;
    }
    if (status === 'failed') {
      console.error('\n❌ Render failed:', JSON.stringify(pollData, null, 2));
      return;
    }
    process.stdout.write(`\r  ${status} — ${elapsed}s elapsed...`);
  }
  console.error('\n❌ Timed out.');
}

main().catch(console.error);
