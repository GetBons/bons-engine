// pinterest-board-map.js
// Maps Bons content pillars to Pinterest board slugs
// Board owner: @get_bons (Pinterest user ID: 08esdhne7pnmb8pv0kdojbz65kwf2d)

const PINTEREST_USER_ID = '08esdhne7pnmb8pv0kdojbz65kwf2d';

const BOARD_MAP = {
  'Outfit Inspiration':  `${PINTEREST_USER_ID}/outfit-inspiration`,
  'Closet Organization': `${PINTEREST_USER_ID}/closet-organization`,
  'Fashion Tech':        `${PINTEREST_USER_ID}/fashion-tech`,
  'Capsule Wardrobe':    `${PINTEREST_USER_ID}/capsule-wardrobe`,
  'Behind the Scenes':   `${PINTEREST_USER_ID}/behind-the-scenes`,
};

// Keywords that signal each pillar — used to auto-detect pillar from script text
const PILLAR_KEYWORDS = {
  'Outfit Inspiration':  ['outfit', 'look', 'style', 'wear', 'dressed', 'fashion'],
  'Closet Organization': ['closet', 'organiz', 'declutter', 'fold', 'storage', 'tidy'],
  'Fashion Tech':        ['app', 'tech', 'ai', 'digital', 'feature', 'scan', 'bons app'],
  'Capsule Wardrobe':    ['capsule', 'minimal', 'staple', 'versatile', 'classic', 'essential'],
  'Behind the Scenes':   ['founder', 'building', 'startup', 'journey', 'bts', 'behind'],
};

/**
 * Get the Pinterest board path for a given content pillar.
 * Falls back to Outfit Inspiration if pillar not found.
 */
function getBoardId(pillar) {
  return BOARD_MAP[pillar] || BOARD_MAP['Outfit Inspiration'];
}

/**
 * Auto-detect pillar from script text (used as fallback).
 */
function detectPillar(scriptText) {
  const lower = scriptText.toLowerCase();
  for (const [pillar, keywords] of Object.entries(PILLAR_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return pillar;
  }
  return 'Outfit Inspiration';
}

module.exports = { BOARD_MAP, PILLAR_KEYWORDS, getBoardId, detectPillar, PINTEREST_USER_ID };
