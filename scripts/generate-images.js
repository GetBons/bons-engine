// generate-images.js
// Generates Pinterest-native portrait images for each content pillar using Ideogram.
// One image per pillar, 2:3 ratio, fashion/lifestyle aesthetic.
// Run: node scripts/generate-images.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;

const BRAND_CONTEXT = `
Bons is an AI-powered personal styling and wardrobe app.
Visual aesthetic: warm, aspirational, minimal. Think clean closets, styled flat lays, soft natural lighting.
Color palette: neutrals, warm whites, soft earth tones, sage green, dusty pink. No bright neons.
Images should feel like they belong on a stylish woman's Pinterest board — aspirational but attainable.
Photography style: editorial fashion, lifestyle, interior design.
`;

// Per-pillar visual direction to keep images on-brand
const PILLAR_STYLE = {
  'Outfit Inspiration':  'a styled outfit flat lay on a light wood or white surface, multiple clothing pieces arranged artfully, accessories, soft shadows',
  'Fashion Tech':        'a sleek smartphone on a styled desk with fashion accessories nearby, app interface visible, minimal tech meets style aesthetic',
  'Closet Organization': 'a beautifully organized walk-in closet or wardrobe, clothes color-coded and neatly hung, minimalist clean lines, warm lighting',
  'Capsule Wardrobe':    'a capsule wardrobe flat lay, 8-10 neutral clothing pieces arranged on a white linen surface, minimal and intentional',
  'Behind the Scenes':   'a stylish creative workspace with a laptop, mood board, fabric swatches, warm ambient light, female entrepreneur aesthetic',
};

async function generateImagePrompt(pillar, script) {
  const styleHint = PILLAR_STYLE[pillar] || 'fashion lifestyle photography flat lay';

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 250,
    messages: [{
      role: 'user',
      content: `${BRAND_CONTEXT}

Content pillar: "${pillar}"
Script excerpt: "${script.slice(0, 200)}"
Visual direction: ${styleHint}

Write a single Ideogram image generation prompt for a Pinterest pin.
Rules:
- No people, no faces (avoids stock photo restrictions and keeps brand consistent)
- No text or words in the image
- Portrait orientation (2:3)
- Warm, aspirational, editorial aesthetic
- Specific about props, colors, textures, lighting
- 40-80 words max

Return ONLY the prompt. No labels, no explanation.`,
    }],
  });

  return response.content[0].text.trim();
}

async function generateImage(prompt) {
  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': IDEOGRAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio: 'ASPECT_2_3',  // Portrait — ideal for Pinterest
        model: 'V_2',
        style_type: 'REALISTIC',
        negative_prompt: 'people, faces, text, words, logos, watermarks, blurry, dark, harsh lighting',
      },
    }),
  });

  const data = await res.json();
  if (!data.data?.[0]?.url) {
    throw new Error(`Ideogram error: ${JSON.stringify(data)}`);
  }
  return data.data[0].url;
}

async function main() {
  if (!IDEOGRAM_API_KEY || IDEOGRAM_API_KEY === 'your_ideogram_api_key_here') {
    console.error('❌ IDEOGRAM_API_KEY not set in .env');
    console.error('   Sign up free at ideogram.ai → Settings → API Keys');
    console.error('   Free tier: 10 images/day — more than enough for 7/week\n');
    process.exit(1);
  }

  const week = getWeekString();
  const scriptsPath = path.join(__dirname, `../scripts/scripts-${week}.json`);

  if (!fs.existsSync(scriptsPath)) {
    console.error(`❌ No scripts for ${week}. Run generate-scripts.js first.`);
    process.exit(1);
  }

  const scripts = JSON.parse(fs.readFileSync(scriptsPath, 'utf8'));

  console.log(`\n🖼️  BONS IMAGE GENERATOR — ${week}`);
  console.log('━'.repeat(40));
  console.log(`Generating ${scripts.length} Pinterest images via Ideogram...\n`);

  const images = [];

  for (const s of scripts) {
    console.log(`  [${s.index}/7] ${s.pillar}...`);
    try {
      const prompt = await generateImagePrompt(s.pillar, s.script);
      console.log(`         Prompt: ${prompt.slice(0, 80)}...`);

      const imageUrl = await generateImage(prompt);
      console.log(`         ✅ Done`);

      images.push({
        index: s.index,
        pillar: s.pillar,
        imagePrompt: prompt,
        imageUrl,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(`         ❌ Failed: ${e.message}`);
      images.push({ index: s.index, pillar: s.pillar, imageUrl: null, error: e.message });
    }

    // Pause between calls to respect rate limits
    if (s.index < scripts.length) await new Promise(r => setTimeout(r, 1500));
  }

  // Save to logs/
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `images-${week}.json`);
  fs.writeFileSync(logPath, JSON.stringify(images, null, 2));

  const ok = images.filter(i => i.imageUrl).length;
  const fail = images.filter(i => !i.imageUrl).length;

  console.log(`\n✅ Images saved to logs/images-${week}.json`);
  console.log(`   ${ok} generated, ${fail} failed\n`);

  return images;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
