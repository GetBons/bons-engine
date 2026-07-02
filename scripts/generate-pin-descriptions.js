// generate-pin-descriptions.js
// Rewrites each Bons video script as an SEO-optimized Pinterest pin description.
// Pinterest SEO works via keywords in the description — no hashtags needed.
// Run directly: node scripts/generate-pin-descriptions.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PILLAR_KEYWORDS = {
  'Outfit Inspiration':  'outfit ideas, style inspiration, what to wear, personal style, fashion inspo, wardrobe ideas, daily outfits',
  'Closet Organization': 'closet organization, wardrobe organization, declutter closet, organize clothes, closet tips, tidy wardrobe',
  'Fashion Tech':        'fashion technology, AI stylist, wardrobe app, personal styling app, AI fashion, smart closet, style tech',
  'Capsule Wardrobe':    'capsule wardrobe, minimalist wardrobe, wardrobe essentials, classic style, versatile outfits, timeless fashion',
  'Behind the Scenes':   'fashion startup, app building, female founder, fashion entrepreneur, startup journey, building a brand',
};

async function generatePinDescription(script, pillar) {
  const keywords = PILLAR_KEYWORDS[pillar] || PILLAR_KEYWORDS['Outfit Inspiration'];

  const prompt = `You are writing a Pinterest pin description for Bons, an AI-powered personal styling and wardrobe app.

Content pillar: ${pillar}
Original video script: ${script}

Write a Pinterest pin description that:
- Is 150-200 words
- Starts with a strong first sentence that works as a standalone headline (Pinterest shows this first)
- Weaves in these SEO keywords naturally: ${keywords}
- Mentions Bons app and directs readers to join the waitlist at getbons.com
- Sounds warm and aspirational, not salesy
- Includes a soft call to action at the end
- NO hashtags (Pinterest SEO is keyword-based, not hashtag-based)

Return only the pin description text. No labels, no formatting.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

async function main() {
  const week = getWeekString();
  const scriptsPath = path.join(__dirname, `../scripts/scripts-${week}.json`);

  if (!fs.existsSync(scriptsPath)) {
    console.error(`❌ No scripts for ${week}. Run generate-scripts.js first.`);
    process.exit(1);
  }

  const scripts = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));

  console.log(`\n📌 BONS PIN DESCRIPTION GENERATOR — ${week}`);
  console.log('━'.repeat(40));
  console.log('Generating SEO descriptions for all 7 pins...\n');

  const pins = [];
  for (const s of scripts) {
    console.log(`  [${s.index}/7] ${s.pillar}...`);
    const pinDescription = await generatePinDescription(s.script, s.pillar);
    pins.push({ ...s, pinDescription });
    if (s.index < scripts.length) await new Promise(r => setTimeout(r, 800));
  }

  const dir = path.join(__dirname, '../scripts');
  const outPath = path.join(dir, `pin-descriptions-${week}.json`);
  fs.writeFileSync(outPath, JSON.stringify(pins, null, 2));

  // Human-readable version
  const readable = pins.map(p => [
    `${'='.repeat(50)}`,
    `Pin ${p.index}: ${p.pillar}`,
    `${'='.repeat(50)}`,
    p.pinDescription,
    '',
  ].join('\n')).join('\n');
  fs.writeFileSync(path.join(dir, `pin-descriptions-${week}.txt`), readable);

  console.log(`\n✅ Pin descriptions saved to scripts/pin-descriptions-${week}.txt\n`);
  return pins;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
