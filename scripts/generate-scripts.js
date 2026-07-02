// generate-scripts.js
// Uses Claude (Anthropic API) to generate 7 Bons video scripts each week.
// 5 scripts go to HeyGen for AI avatar videos.
// 2 scripts go to Bonnie for on-camera filming.
// Run directly: node scripts/generate-scripts.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 7 pillars for the week — rotate to keep content varied
// First 5 = AI avatar videos, last 2 = Bonnie on-camera
const WEEKLY_PILLARS = [
  'Outfit Inspiration',
  'Fashion Tech',
  'Closet Organization',
  'Capsule Wardrobe',
  'Behind the Scenes',
  'Outfit Inspiration',   // Script 6 — Bonnie films this
  'Fashion Tech',          // Script 7 — Bonnie films this
];

const BRAND_VOICE = `
Bons is an AI-powered personal styling and wardrobe app.
Tone: warm, aspirational, witty — like your most stylish friend who happens to love tech.
Bonnie (the founder) is real, relatable, and confident.
The app is NOT launched yet — always direct viewers to join the waitlist at getbons.com.
Never use the word "Dresst". The app is called Bons.
`;

async function generateScript(pillar, scriptNumber, isOnCamera) {
  const cameraNote = isOnCamera
    ? 'This will be filmed by Bonnie on her iPhone. Write in first person as Bonnie speaking directly to camera.'
    : 'This will be narrated by an AI avatar. Write as a warm, confident voice-over.';

  const prompt = `${BRAND_VOICE}

Write a short-form video script for Bons for the content pillar: "${pillar}"

${cameraNote}

Requirements:
- 30-45 seconds when spoken aloud (~75-100 words)
- Format: vertical video (TikTok / Instagram Reels)
- Structure:
  HOOK: First 1-2 sentences. Must grab attention in 3 seconds. Start mid-action or with a question.
  BODY: The main value — tip, insight, story, or demo of the Bons concept.
  CTA: End with a natural call to action pointing to getbons.com waitlist.
- No emojis, no hashtags (those go in the caption separately)
- Sound conversational, not scripted

Return ONLY the script text. No labels, no formatting, just the words to speak.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

function getWeekString() {
  const d = new Date();
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-w${String(week).padStart(2, '0')}`;
}

async function main() {
  console.log('\n📝 BONS SCRIPT GENERATOR');
  console.log('━'.repeat(40));

  const scripts = [];

  for (let i = 0; i < WEEKLY_PILLARS.length; i++) {
    const pillar = WEEKLY_PILLARS[i];
    const isOnCamera = i >= 5; // Scripts 6 & 7 are Bonnie on-camera
    const label = isOnCamera ? '🎬 Bonnie on-camera' : '🤖 AI avatar';
    console.log(`\n  [${i + 1}/7] ${pillar} — ${label}`);

    const script = await generateScript(pillar, i + 1, isOnCamera);
    scripts.push({
      index: i + 1,
      pillar,
      type: isOnCamera ? 'on-camera' : 'ai-avatar',
      script,
      generatedAt: new Date().toISOString(),
    });

    // Brief pause to avoid rate limits
    if (i < WEEKLY_PILLARS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Save JSON (used by other scripts)
  const week = getWeekString();
  const dir = path.join(__dirname, '../scripts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const jsonPath = path.join(dir, `scripts-${week}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(scripts, null, 2));

  // Save readable text file for Paul to review & edit
  const txtPath = path.join(dir, `scripts-${week}.txt`);
  const readable = scripts.map(s => [
    `${'='.repeat(50)}`,
    `Script ${s.index}: ${s.pillar} [${s.type === 'on-camera' ? 'BONNIE FILMS THIS' : 'AI AVATAR'}]`,
    `${'='.repeat(50)}`,
    s.script,
    '',
  ].join('\n')).join('\n');
  fs.writeFileSync(txtPath, readable);

  console.log(`\n✅ Scripts saved:`);
  console.log(`   ${txtPath}  ← OPEN THIS, read and edit`);
  console.log(`   ${jsonPath}  ← used by next steps\n`);

  return scripts;
}

function getWeekStringExported() { return getWeekString(); }

module.exports = { main, getWeekString: getWeekStringExported };
if (require.main === module) main().catch(console.error);
