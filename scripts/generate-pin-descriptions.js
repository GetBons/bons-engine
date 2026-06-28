require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generatePinDescription(script) {
  const prompt = `You are writing Pinterest pin descriptions for Bons (pronounced "Bonz"), an AI-powered fashion app that helps women build outfits from clothes already in their closet.

Pinterest is a search engine, not a social feed. Write copy that:
- Is 150-300 characters
- Includes natural keywords people search for on Pinterest (e.g. "outfit ideas", "capsule wardrobe", "how to style", "closet organization tips")
- Sounds helpful and inspiring, not like an ad
- Ends with a soft CTA like "Save this for outfit inspo" or "Join the Bons waitlist — link in bio @get_bons"
- NO hashtag spam — 2-5 max, worked naturally into the text

Here is the content this pin is based on:

PILLAR: ${script.pillar}
HOOK: ${script.hook}
INSTAGRAM CAPTION: ${script.caption}

Write ONLY the Pinterest pin description — no preamble, no labels, just the text itself.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim();
}

module.exports = { generatePinDescription };
