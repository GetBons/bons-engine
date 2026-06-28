require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const AVATAR_ID = process.env.HEYGEN_AVATAR_ID;
const VOICE_ID  = process.env.HEYGEN_VOICE_ID;

function parseScripts(scriptText) {
  const days = scriptText.split('---').filter(s => s.trim());
  return days.map(day => {
    const lines = day.trim().split('\n');
    const script = {};
    lines.forEach(line => {
      if (line.startsWith('DAY'))       script.day        = line.trim();
      if (line.startsWith('TYPE:'))     script.type       = line.replace('TYPE:', '').trim();
      if (line.startsWith('PILLAR:'))   script.pillar     = line.replace('PILLAR:', '').trim();
      if (line.startsWith('HOOK:'))     script.hook       = line.replace('HOOK:', '').trim();
      if (line.startsWith('SCRIPT:'))   script.scriptText = line.replace('SCRIPT:', '').trim();
      if (line.startsWith('CAPTION:'))  script.caption    = line.replace('CAPTION:', '').trim();
      if (line.startsWith('HASHTAGS:')) script.hashtags   = line.replace('HASHTAGS:', '').trim();
    });
    return script;
  }).filter(s => s.scriptText);
}

async function createHeyGenVideo(scriptText) {
  console.log(`  📤 Submitting to HeyGen: "${scriptText.substring(0, 50)}..."`);
  try {
    const response = await axios.post(
      'https://api.heygen.com/v2/video/generate',
      {
        video_inputs: [{
          character:  { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal' },
          voice:      { type: 'text', input_text: scriptText, voice_id: VOICE_ID, speed: 1.0 },
          background: { type: 'color', value: '#f7f4ef' }
        }],
        dimension: { width: 1080, height: 1920 },
        aspect_ratio: '9:16',
        test: false
      },
      { headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY, 'Content-Type': 'application/json' } }
    );
    return response.data.data.video_id;
  } catch (error) {
    console.error(`  ❌ HeyGen error: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function waitForVideo(videoId, maxWaitMinutes = 10) {
  console.log(`  ⏳ Waiting for video to render...`);
  for (let i = 0; i < maxWaitMinutes * 6; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const res = await axios.get(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      { headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY } }
    );
    const status = res.data.data;
    if (status.status === 'completed') { console.log(`  ✅ Ready!`); return status.video_url; }
    if (status.status === 'failed')    { console.error(`  ❌ Failed`); return null; }
    process.stdout.write('.');
  }
  return null;
}

async function generateVideos() {
  const today      = new Date().toISOString().split('T')[0];
  const scriptFile = `./scripts/week-${today}/week-scripts.txt`;

  if (!await fs.pathExists(scriptFile)) {
    console.error('❌ No scripts found. Run generate-scripts.js first.');
    process.exit(1);
  }

  const scriptText = await fs.readFile(scriptFile, 'utf8');
  const scripts    = parseScripts(scriptText);
  const aiScripts  = scripts.filter(s => s.type === 'AI-VOICEOVER');
  const onCamera   = scripts.filter(s => s.type === 'ON-CAMERA');

  console.log(`📱 ${aiScripts.length} AI videos to generate`);
  console.log(`🎥 ${onCamera.length} on-camera scripts for Bonnie\n`);

  const bonnieDir = `./bonnie-footage/week-${today}`;
  await fs.ensureDir(bonnieDir);
  const bonnieContent = onCamera.map(s =>
    `${s.day}\nPILLAR: ${s.pillar}\nHOOK: ${s.hook}\n\nSCRIPT:\n${s.scriptText}\n\nCAPTION: ${s.caption}\n${s.hashtags}\n\n${'='.repeat(50)}\n`
  ).join('\n');
  await fs.writeFile(path.join(bonnieDir, 'bonnie-filming-list.txt'), bonnieContent);
  console.log(`📄 Bonnie's filming list saved to ${bonnieDir}/bonnie-filming-list.txt\n`);

  const results = [];
  for (const script of aiScripts) {
    console.log(`\n${script.day} (${script.pillar}):`);
    const videoId = await createHeyGenVideo(script.scriptText);
    if (videoId) {
      const videoUrl = await waitForVideo(videoId);
      results.push({ day: script.day, type: 'AI-VOICEOVER', pillar: script.pillar, hook: script.hook, videoUrl, caption: script.caption, hashtags: script.hashtags, videoId });
    }
  }

  for (const script of onCamera) {
    results.push({ day: script.day, type: 'ON-CAMERA', pillar: script.pillar, hook: script.hook, videoUrl: null, caption: script.caption, hashtags: script.hashtags, needsManualUpload: true });
  }

  results.sort((a, b) => parseInt(a.day.match(/\d+/)) - parseInt(b.day.match(/\d+/)));
  await fs.writeJson(`./logs/videos-${today}.json`, results, { spaces: 2 });
  console.log('\n🎉 AI video generation complete!');
  console.log('\nNext: node scripts/schedule-posts.js');
}

generateVideos().catch(console.error);
