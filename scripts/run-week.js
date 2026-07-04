// run-week.js
// Master weekly automation — runs the full Bons content pipeline end to end.
// Run every Sunday: node scripts/run-week.js
//
// Flow:
//   1. Generate 7 video scripts (Claude)
//   2. Submit all 7 to HeyGen for rendering
//   3. Generate Pinterest images + LinkedIn posts in parallel (while HeyGen renders)
//   4. Wait for all HeyGen videos to finish
//   5. Schedule everything to Publer (TikTok, Instagram, LinkedIn, Pinterest)

require('dotenv').config();
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Import sub-module main() functions ─────────────────────────────────────
const { main: generateScripts, getWeekString } = require('./generate-scripts');
const { main: generateVideos }   = require('./generate-videos');
const { main: generateImages }   = require('./generate-images');
const { main: generateLinkedIn } = require('./generate-linkedin');
const { main: schedulePosts }    = require('./schedule-posts');

// schedule-pinterest and schedule-linkedin are standalone scripts, call via exec
function runScript(name, args = '') {
  const cmd = `node ${path.join(__dirname, name)} ${args}`.trim();
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

function banner(title) {
  const line = '━'.repeat(50);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
}

function elapsed(startMs) {
  const s = Math.round((Date.now() - startMs) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

async function main() {
  const start = Date.now();
  const week  = getWeekString();

  console.log(`\n🚀 BONS WEEKLY RUN — ${week}`);
  console.log(`   Starting: ${new Date().toLocaleString()}`);
  console.log('   This will take ~30-40 min (HeyGen renders in background)\n');

  // ── Step 1: Generate scripts ──────────────────────────────────────────────
  banner('Step 1/5 — Generating video scripts (Claude)');
  const t1 = Date.now();
  await generateScripts();
  console.log(`\n✅ Scripts done (${elapsed(t1)})`);

  // ── Step 2: Submit videos to HeyGen ──────────────────────────────────────
  banner('Step 2/5 — Submitting videos to HeyGen');
  const t2 = Date.now();
  await generateVideos();
  console.log(`\n✅ Videos done (${elapsed(t2)})`);

  // ── Step 3: Generate Pinterest images + LinkedIn posts (parallel) ─────────
  banner('Step 3/5 — Generating Pinterest images + LinkedIn posts');
  const t3 = Date.now();
  await Promise.all([
    generateImages().catch(e  => console.warn(`⚠️  Images failed: ${e.message}`)),
    generateLinkedIn().catch(e => console.warn(`⚠️  LinkedIn gen failed: ${e.message}`)),
  ]);
  console.log(`\n✅ Images + LinkedIn content done (${elapsed(t3)})`);

  // ── Step 4: Schedule TikTok + Instagram + LinkedIn ────────────────────────
  banner('Step 4/5 — Scheduling TikTok, Instagram, LinkedIn (Publer)');
  const t4 = Date.now();
  await schedulePosts();
  console.log(`\n✅ TikTok / Instagram / LinkedIn scheduled (${elapsed(t4)})`);

  // ── Step 5: Schedule Pinterest pins ──────────────────────────────────────
  banner('Step 5/5 — Scheduling Pinterest pins (Publer)');
  const t5 = Date.now();
  runScript('schedule-pinterest.js', week);
  console.log(`\n✅ Pinterest scheduled (${elapsed(t5)})`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const line = '━'.repeat(50);
  console.log(`\n${line}`);
  console.log(`  🎉 WEEK ${week} COMPLETE`);
  console.log(`  Total time: ${elapsed(start)}`);
  console.log(`  Verify: https://app.publer.com → Scheduled Posts`);
  console.log(line);
  console.log('');
}

main().catch(e => {
  console.error(`\n❌ Fatal error: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
