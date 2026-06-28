require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs-extra');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PILLARS = [
  "Outfit Inspiration — Multiple looks from existing wardrobe pieces",
  "App Behind the Scenes — How Bons AI works, building the product",
  "Closet Organization — Declutter tips, capsule wardrobe advice",
  "Founder Story — Bonnie on camera, why she built Bons",
  "Trending Fashion — React to trends, recreate looks from your closet"
];

const WEEK_PLAN = [
  { day: 1, type: 'AI-VOICEOVER', pillar: PILLARS[0] },
  { day: 2, type: 'AI-VOICEOVER', pillar: PILLARS[2] },
  { day: 3, type: 'ON-CAMERA',    pillar: PILLARS[3] },
  { day: 4, type: 'AI-VOICEOVER', pillar: PILLARS[1] },
  { day: 5, type: 'AI-VOICEOVER', pillar: PILLARS[4] },
  { day: 6, type: 'AI-VOICEOVER', pillar: PILLARS[0] },
  { day: 7, type: 'ON-CAMERA',    pillar: PILLARS[3] }
];

async function generateWeeklyScripts() {
  console.log('🎬 Starting Bons weekly script generation...\n');
  const today = new Date().toISOString().split('T')[0];
  const outputDir = `./scripts/week-${today}`;
  await fs.ensureDir(outputDir);

  const prompt = `You are a social media content creator for Bons (pronounced "Bonz"), an AI-powered fashion app that helps women use clothes already in their closet to build outfits.

Brand voice: Smart, stylish, relatable, aspirational but accessible, empowering
Tagline: Your good things, finally working for you.
Target audience: Women ages 25-45 who love fashion but feel overwhelmed by their closet
Goal: Brand awareness and waitlist signups (app is currently in development)
Founder: Bonnie — authentic, passionate, relatable
Social handles: @get_bons on TikTok, Instagram, and Pinterest

Generate exactly 7 short-form video scripts following this plan:
${WEEK_PLAN.map(d => `Day ${d.day}: TYPE=${d.type}, PILLAR=${d.pillar}`).join('\n')}

Rules:
- AI-VOICEOVER scripts: calm, confident AI avatar voice. Visual-led.
- ON-CAMERA scripts: Bonnie's authentic first-person founder voice. Conversational.
- Each script 30-60 seconds spoken (75-150 words)
- Strong hook in first 3 seconds
- End every script with CTA: "Join the waitlist — link in bio @get_bons"

Format each exactly like this:

DAY [number]:
TYPE: [AI-VOICEOVER or ON-CAMERA]
PILLAR: [pillar name]
HOOK: [first line]
SCRIPT: [full script]
CAPTION: [caption with emojis]
HASHTAGS: [12-15 relevant hashtags]
---

Generate all 7 days now.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const scripts = response.content[0].text;
  await fs.writeFile(path.join(outputDir, 'week-scripts.txt'), scripts);
  console.log(`✅ Scripts saved to ${outputDir}/week-scripts.txt`);
  console.log('📖 Open the file and review before generating videos.');
  console.log('\nNext: node scripts/generate-videos.js');
}

generateWeeklyScripts().catch(console.error);
