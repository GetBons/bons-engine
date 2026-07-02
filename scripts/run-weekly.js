// run-weekly.js
// THE MAIN COMMAND — run this every Sunday to produce a full week of Bons content.
//
// Usage: node scripts/run-weekly.js
//
// What it does:
//   1. Generates 7 video scripts using Claude
//   2. Pauses so you can review & edit
//   3. Submits 5 scripts to HeyGen for AI avatar videos
//   4. Reminds Bonnie to film scripts 6 & 7
//   5. Generates SEO Pinterest descriptions for all 7 pins
//   6. Schedules everything to TikTok, Instagram & Pinterest via Publer

require('dotenv').config();
const readline = require('readline');
const path     = require('path');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

function checkEnv() {
  const required = {
    ANTHROPIC_API_KEY:  'Anthropic API key (console.anthropic.com)',
    PUBLER_API_KEY:     'Publer API key (app.publer.com → Settings → API)',
    PUBLER_TIKTOK_ID:   'Publer TikTok profile ID (run get-publer-ids.js)',
    PUBLER_INSTAGRAM_ID:'Publer Instagram profile ID (run get-publer-ids.js)',
    PUBLER_PINTEREST_ID:'Publer Pinterest profile ID (run get-publer-ids.js)',
  };

  const optional = {
    HEYGEN_API_KEY:     'HeyGen API key — required for AI avatar videos',
    HEYGEN_AVATAR_ID:   'HeyGen avatar ID — required for AI avatar videos',
    ELEVENLABS_VOICE_ID:'ElevenLabs voice ID — required for AI avatar videos',
  };

  let missingRequired = false;
  let missingOptional = false;

  for (const [key, desc] of Object.entries(required)) {
    if (!process.env[key]) {
      console.error(`  ❌ Missing: ${key} — ${desc}`);
      missingRequired = true;
    }
  }

  for (const [key, desc] of Object.entries(optional)) {
    if (!process.env[key]) {
      console.warn(`  ⚠️  Optional: ${key} — ${desc}`);
      missingOptional = true;
    }
  }

  return { missingRequired, missingOptional };
}

async function main() {
  console.log('\n🌟  BONS WEEKLY CONTENT ENGINE');
  console.log('═'.repeat(45));
  console.log('This Sunday run will schedule a full week of');
  console.log('content across TikTok, Instagram & Pinterest.\n');

  // Check environment
  console.log('Checking configuration...');
  const { missingRequired, missingOptional } = checkEnv();

  if (missingRequired) {
    console.error('\n❌ Fix the missing required values in your .env file, then re-run.\n');
    process.exit(1);
  }

  if (missingOptional) {
    const skip = await prompt('\n⚠️  HeyGen/ElevenLabs not configured. Skip AI video generation? (y/n): ');
    if (skip.toLowerCase() !== 'y') {
      console.log('Add HEYGEN_API_KEY, HEYGEN_AVATAR_ID, and ELEVENLABS_VOICE_ID to .env, then re-run.\n');
      process.exit(0);
    }
  }

  // ──────────────────────────────────────
  // STEP 1: Generate scripts
  // ──────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log('STEP 1 OF 5 — Generate Scripts');
  console.log('─'.repeat(45));
  const { main: generateScripts, getWeekString } = require('./generate-scripts');
  await generateScripts();

  // ──────────────────────────────────────
  // STEP 2: Paul reviews
  // ──────────────────────────────────────
  const week = getWeekString();
  const scriptFile = path.join(__dirname, `../scripts/scripts-${week}.txt`);

  console.log('\n' + '─'.repeat(45));
  console.log('STEP 2 OF 5 — Review Scripts');
  console.log('─'.repeat(45));
  console.log(`\n📄 Open this file and read all 7 scripts:`);
  console.log(`   ${scriptFile}`);
  console.log('\n   Edit anything that sounds off.');
  console.log('   The JSON file updates automatically when you save the .txt.\n');
  console.log('   (Actually: edit the .json file directly if you want to change scripts');
  console.log('   that feed into video generation and scheduling.)\n');
  await prompt('Press ENTER when you\'re happy with the scripts → ');

  // ──────────────────────────────────────
  // STEP 3: Generate AI videos (optional)
  // ──────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log('STEP 3 OF 5 — Generate AI Videos');
  console.log('─'.repeat(45));

  if (!missingOptional) {
    const { main: generateVideos } = require('./generate-videos');
    await generateVideos();
  } else {
    console.log('\n⚠️  Skipping AI video generation (HeyGen not configured).');
    console.log('   You can still schedule posts once you have video URLs.\n');
  }

  // ──────────────────────────────────────
  // STEP 3b: Bonnie films her 2 videos
  // ──────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log('STEP 3b — Bonnie Films Her 2 Videos');
  console.log('─'.repeat(45));
  console.log(`\n📱 Bonnie: Film scripts 6 & 7 on your iPhone.`);
  console.log(`   Save the files here:`);
  console.log(`   bonnie-footage/script-6.mp4`);
  console.log(`   bonnie-footage/script-7.mp4\n`);
  await prompt('Press ENTER when Bonnie\'s videos are saved to bonnie-footage/ → ');

  // ──────────────────────────────────────
  // STEP 4: Pinterest descriptions
  // ──────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log('STEP 4 OF 5 — Pinterest SEO Descriptions');
  console.log('─'.repeat(45));
  const { main: generatePinDescriptions } = require('./generate-pin-descriptions');
  await generatePinDescriptions();

  // ──────────────────────────────────────
  // STEP 5: Schedule everything
  // ──────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log('STEP 5 OF 5 — Schedule to Publer');
  console.log('─'.repeat(45) + '\n');
  const { main: schedulePosts } = require('./schedule-posts');
  await schedulePosts();

  // ──────────────────────────────────────
  // Done
  // ──────────────────────────────────────
  console.log('\n' + '═'.repeat(45));
  console.log('✅  BONS WEEKLY ENGINE COMPLETE');
  console.log('═'.repeat(45));
  console.log('\nThis week\'s content is scheduled across:');
  console.log('  📱 TikTok   @get_bons — 7 videos');
  console.log('  📸 Instagram @get_bons — 7 Reels');
  console.log('  📌 Pinterest @get_bons — 7 pins → 5 boards');
  console.log('\nVerify in Publer dashboard → Scheduled Posts.');
  console.log('See you next Sunday! 🎉\n');
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
