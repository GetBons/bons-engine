// generate-images.js
// Fetches Pinterest-native portrait images for each content pillar using Pexels (free).
// Searches for high-quality fashion/lifestyle stock photos matching each pillar.
// Run: node scripts/generate-images.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_BASE = 'https://api.pexels.com/v1';

// Search terms per content pillar — ordered by relevance, tries each until a good photo is found
const PILLAR_SEARCHES = {
  'Outfit Inspiration':  ['outfit flat lay fashion', 'fashion flat lay clothing', 'styled outfit clothes'],
  'Fashion Tech':        ['woman smartphone fashion', 'fashion app style phone', 'woman using phone fashion'],
  'Closet Organization': ['organized closet wardrobe', 'minimalist closet clothes', 'walk in closet organized'],
  'Capsule Wardrobe':    ['capsule wardrobe minimal', 'minimal fashion clothes neutral', 'neutral wardrobe flat lay'],
  'Behind the Scenes':   ['woman entrepreneur desk', 'creative workspace fashion', 'female founder laptop workspace'],
};

async function fetchPexelsPhoto(pillar) {
  const queries = PILLAR_SEARCHES[pillar] || ['fashion lifestyle'];

  for (const query of queries) {
    const url = `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5&size=large`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
    });

    if (!res.ok) {
      throw new Error(`Pexels API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const photos = data.photos || [];

    if (photos.length > 0) {
      // Pick a different photo each week based on week number to avoid repeating
      const week = getWeekString();
      const weekNum = parseInt(week.split('-w')[1]) || 1;
      const photo = photos[weekNum % photos.length];

      return {
        url: photo.src.portrait,       // 800×1200px — ideal for Pinterest
        fullUrl: photo.src.large2x,    // higher res backup
        photographer: photo.photographer,
        pexelsUrl: photo.url,
        query,
      };
    }
  }

  throw new Error(`No photos found for pillar: ${pillar}`);
}

async function main() {
  if (!PEXELS_API_KEY || PEXELS_API_KEY === 'your_pexels_api_key_here') {
    console.error('❌ PEXELS_API_KEY not set in .env');
    console.error('   Sign up free at pexels.com/api — takes 2 minutes, no credit card.\n');
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
  console.log(`Fetching ${scripts.length} Pinterest images from Pexels...\n`);

  const images = [];

  for (const s of scripts) {
    console.log(`  [${s.index}/7] ${s.pillar}...`);
    try {
      const photo = await fetchPexelsPhoto(s.pillar);
      console.log(`         ✅ Found (search: "${photo.query}", photo by ${photo.photographer})`);

      images.push({
        index: s.index,
        pillar: s.pillar,
        imageUrl: photo.url,
        imageUrlHiRes: photo.fullUrl,
        photographer: photo.photographer,
        pexelsUrl: photo.pexelsUrl,
        searchQuery: photo.query,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(`         ❌ Failed: ${e.message}`);
      images.push({ index: s.index, pillar: s.pillar, imageUrl: null, error: e.message });
    }

    // Small pause between requests
    if (s.index < scripts.length) await new Promise(r => setTimeout(r, 300));
  }

  // Save to logs/
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `images-${week}.json`);
  fs.writeFileSync(logPath, JSON.stringify(images, null, 2));

  const ok = images.filter(i => i.imageUrl).length;
  const fail = images.filter(i => !i.imageUrl).length;

  console.log(`\n✅ Images saved to logs/images-${week}.json`);
  console.log(`   ${ok} found, ${fail} failed\n`);

  return images;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
