// generate-linkedin.js
// Generates LinkedIn text posts for each content pillar.
// Audience: business professionals — dressing for work, travel, client meetings, casual Fridays.
// Written in Paul's founder voice. Saves to scripts/linkedin-WEEK.json.
// Run: node scripts/generate-linkedin.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { getWeekString } = require('./generate-scripts');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FOUNDER_VOICE = `
You are writing LinkedIn posts for Paul Brust, founder of Bons — an AI-powered wardrobe styling app.
Paul's voice: direct, thoughtful, warm. He talks like a founder who spotted a real problem and built something to fix it.
He's not salesy. He shares genuine insights. He respects his audience's intelligence.

Target audience: professional women, 30-50, busy careers — executives, consultants, entrepreneurs.
Their wardrobe problems: nothing to wear to the client dinner, overpacked for work travel,
closet full of clothes that don't work together, casual Fridays feel harder than formal days.

Bons is NOT launched yet. Always direct to the waitlist at getbons.com.
Never say "I" alone — use "we" when referring to building Bons.
`;

// How each pillar maps to a business professional's world
const BUSINESS_ANGLE = {
  'Outfit Inspiration': 'Dressing for work situations — client meetings, board presentations, Zoom calls, business dinners, casual Fridays. The specific challenge of looking put-together under pressure.',
  'Fashion Tech': 'How AI is solving a real problem for busy professionals — the time wasted deciding what to wear, the mental load of maintaining a work wardrobe, the opportunity cost of looking unprepared.',
  'Closet Organization': 'Work wardrobe efficiency — packing light for business travel, keeping a functional work wardrobe, the system that makes getting dressed fast and consistent.',
  'Capsule Wardrobe': 'The professional capsule wardrobe — the core pieces every business woman needs, building a wardrobe that works across work contexts without buying more.',
  'Behind the Scenes': 'The founder perspective — why we built Bons for the professional woman, what we learned talking to busy women about their wardrobe frustrations, the problem nobody was solving.',
};

async function generateLinkedInPost(pillar, script) {
  const angle = BUSINESS_ANGLE[pillar] || 'professional wardrobe and getting dressed for work';

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `${FOUNDER_VOICE}

Content pillar: "${pillar}"
Business angle: ${angle}
Original video script (for context/inspiration — do NOT copy it): "${script}"

Write a LinkedIn text post for Paul Brust, founder of Bons.

Format:
- 3-4 short paragraphs (2-4 sentences each)
- First line is the hook — bold claim, provocative question, or surprising insight. No "I" to start.
- Body: one sharp insight or observation relevant to busy professional women
- End with a soft CTA pointing to getbons.com waitlist
- 2-3 relevant hashtags at the very end (e.g. #careerwomen #workstyle #wardrobetech)
- Total length: 150-200 words

Tone: like a smart founder sharing a genuine observation, not a brand posting content.
Do NOT use: "game-changer", "exciting", "thrilled", "passionate", "journey", "honored".

Return ONLY the post text. No labels, no explanation.`,
    }],
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

  console.log(`\n💼 BONS LINKEDIN GENERATOR — ${week}`);
  console.log('━'.repeat(40));
  console.log(`Writing ${scripts.length} LinkedIn posts for professional audience...\n`);

  const posts = [];

  for (const s of scripts) {
    console.log(`  [${s.index}/7] ${s.pillar}...`);
    const post = await generateLinkedInPost(s.pillar, s.script);
    console.log(`         ✅ Done (${post.split(' ').length} words)`);

    posts.push({
      index: s.index,
      pillar: s.pillar,
      linkedInPost: post,
      generatedAt: new Date().toISOString(),
    });

    if (s.index < scripts.length) await new Promise(r => setTimeout(r, 1000));
  }

  // Save JSON
  const dir = path.join(__dirname, '../scripts');
  const jsonPath = path.join(dir, `linkedin-${week}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(posts, null, 2));

  // Save readable text file for Paul to review
  const txtPath = path.join(dir, `linkedin-${week}.txt`);
  const readable = posts.map(p => [
    `${'='.repeat(50)}`,
    `Post ${p.index}: ${p.pillar}`,
    `${'='.repeat(50)}`,
    p.linkedInPost,
    '',
  ].join('\n')).join('\n');
  fs.writeFileSync(txtPath, readable);

  console.log(`\n✅ LinkedIn posts saved:`);
  console.log(`   ${txtPath}  ← REVIEW THIS before scheduling`);
  console.log(`   ${jsonPath}  ← used by schedule-posts.js\n`);

  return posts;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
