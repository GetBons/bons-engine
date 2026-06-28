require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const { getBoardForPillar } = require('./pinterest-board-map');
const { generatePinDescription } = require('./generate-pin-descriptions');

const POSTING_TIMES = [
  '07:00', // Day 1
  '12:00', // Day 2
  '18:00', // Day 3 — Bonnie on-camera
  '12:00', // Day 4
  '09:00', // Day 5
  '11:00', // Day 6
  '18:00'  // Day 7 — Bonnie on-camera
];

const PINTEREST_TIMES = [
  '08:00', // Day 1
  '20:00', // Day 2
  '19:00', // Day 3
  '13:00', // Day 4
  '10:00', // Day 5
  '14:00', // Day 6
  '20:00'  // Day 7
];

function getNextSevenDays() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

async function scheduleVideoPost({ videoUrl, caption, hashtags, scheduledTime }) {
  console.log(`  📅 TikTok + Instagram → ${scheduledTime}`);
  try {
    const response = await axios.post(
      'https://api.publer.io/v1/posts',
      {
        text: `${caption}\n\n${hashtags}`,
        media: [{ url: videoUrl, type: 'video' }],
        scheduled_at: scheduledTime,
        profiles: [
          process.env.PUBLER_INSTAGRAM_ID,
          process.env.PUBLER_TIKTOK_ID
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PUBLER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(`  ❌ TikTok/Instagram error: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function schedulePinterestPost({ videoUrl, pinDescription, pillar, scheduledTime }) {
  const boardId = getBoardForPillar(pillar);
  console.log(`  📌 Pinterest → ${scheduledTime}`);
  try {
    const response = await axios.post(
      'https://api.publer.io/v1/posts',
      {
        text: pinDescription,
        media: [{ url: videoUrl, type: 'video' }],
        scheduled_at: scheduledTime,
        profiles: [process.env.PUBLER_PINTEREST_ID],
        pinterest: {
          board_id: boardId,
          title: `Bons — ${pillar.split('—')[0].trim()}`
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PUBLER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(`  ❌ Pinterest error: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function schedulePosts() {
  const today    = new Date().toISOString().split('T')[0];
  const videoLog = `./logs/videos-${today}.json`;

  if (!await fs.pathExists(videoLog)) {
    console.error('❌ No video log found. Run generate-videos.js first.');
    process.exit(1);
  }

  const videos = await fs.readJson(videoLog);
  const dates  = getNextSevenDays();

  console.log('📅 Scheduling Bons posts — TikTok + Instagram + Pinterest\n');

  let skipped = 0;

  for (let i = 0; i < videos.length; i++) {
    const video     = videos[i];
    const videoDate = dates[i];

    if (!video.videoUrl) {
      console.log(`\n  ⏭️  ${video.day} skipped — video not ready yet`);
      skipped++;
      continue;
    }

    console.log(`\n━━━ ${video.day} (${video.type}) ━━━`);

    // TikTok + Instagram
    const videoTime = `${videoDate}T${POSTING_TIMES[i]}:00`;
    await scheduleVideoPost({
      videoUrl: video.videoUrl,
      caption: video.caption,
      hashtags: video.hashtags,
      scheduledTime: videoTime
    });
    console.log(`  ✅ TikTok + Instagram scheduled`);

    // Pinterest
    console.log(`  ✍️  Generating Pinterest pin description...`);
    const pinDescription = await generatePinDescription({
      pillar:  video.pillar  || 'Outfit Inspiration',
      hook:    video.hook    || '',
      caption: video.caption
    });

    const pinterestTime = `${videoDate}T${PINTEREST_TIMES[i]}:00`;
    await schedulePinterestPost({
      videoUrl: video.videoUrl,
      pinDescription,
      pillar: video.pillar || 'Outfit Inspiration',
      scheduledTime: pinterestTime
    });
    console.log(`  ✅ Pinterest scheduled`);

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n\n🎉 All platforms scheduled for the week!');
  console.log('  ✅ TikTok');
  console.log('  ✅ Instagram');
  console.log('  ✅ Pinterest');

  if (skipped > 0) {
    console.log(`\n⚠️  ${skipped} post(s) skipped — add missing video URLs and re-run.`);
  }

  console.log('\n📱 Check your Publer dashboard to confirm everything looks right.');
}

schedulePosts().catch(console.error);
