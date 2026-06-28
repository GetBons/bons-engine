require('dotenv').config();
const { execSync } = require('child_process');

async function runWeekly() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   BONS CONTENT ENGINE — WEEKLY RUN       ║');
  console.log('║   TikTok · Instagram · Pinterest          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('\n🗓️  Starting weekly content pipeline...\n');

  try {
    // STEP 1: Generate Scripts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: GENERATING SCRIPTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    execSync('node scripts/generate-scripts.js', { stdio: 'inherit' });

    // PAUSE — review scripts before videos are made
    console.log('\n⚠️  REVIEW STEP');
    console.log('Scripts have been generated.');
    console.log('Open the script file and review before continuing.');
    console.log('Press ENTER when ready to generate AI videos...');
    await new Promise(resolve => process.stdin.once('data', resolve));

    // STEP 2: Generate Videos
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: GENERATING AI VIDEOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    execSync('node scripts/generate-videos.js', { stdio: 'inherit' });

    // PAUSE — Bonnie films her clips
    console.log('\n⚠️  FILMING STEP');
    console.log('Bonnie needs to film her 2 on-camera videos now.');
    console.log('Checklist is in ./bonnie-footage/week-[date]/bonnie-filming-list.txt');
    console.log('Add Bonnie\'s video URLs to ./logs/videos-[date].json when ready.');
    console.log('Press ENTER when Bonnie\'s clips are uploaded and logged...');
    await new Promise(resolve => process.stdin.once('data', resolve));

    // STEP 3: Schedule Posts
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: SCHEDULING ALL POSTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    execSync('node scripts/schedule-posts.js', { stdio: 'inherit' });

    console.log('\n');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   ✅ WEEKLY RUN COMPLETE!                ║');
    console.log('║                                          ║');
    console.log('║   Check Publer dashboard to confirm.     ║');
    console.log('║   All 3 platforms scheduled for week.    ║');
    console.log('╚══════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ Error in pipeline:', error.message);
    console.log('Open Claude Code (type claude in Terminal) and describe the error.');
  }
}

runWeekly();
