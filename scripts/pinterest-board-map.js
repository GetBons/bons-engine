require('dotenv').config();

const BOARD_MAP = {
  'Outfit Inspiration — Multiple looks from existing wardrobe pieces':    process.env.PINTEREST_BOARD_OUTFIT,
  'Closet Organization — Declutter tips, capsule wardrobe advice':        process.env.PINTEREST_BOARD_CLOSET,
  'App Behind the Scenes — How Bons AI works, building the product':      process.env.PINTEREST_BOARD_BEHINDTHEBUILD,
  'Founder Story — Bonnie on camera, why she built Bons':                 process.env.PINTEREST_BOARD_BEHINDTHEBUILD,
  'Trending Fashion — React to trends, recreate looks from your closet':  process.env.PINTEREST_BOARD_CAPSULE
};

function getBoardForPillar(pillar) {
  if (BOARD_MAP[pillar]) return BOARD_MAP[pillar];
  const p = pillar.toLowerCase();
  if (p.includes('outfit'))                          return process.env.PINTEREST_BOARD_OUTFIT;
  if (p.includes('closet') || p.includes('organ'))   return process.env.PINTEREST_BOARD_CLOSET;
  if (p.includes('behind') || p.includes('found') || p.includes('app')) return process.env.PINTEREST_BOARD_BEHINDTHEBUILD;
  if (p.includes('capsule') || p.includes('trend'))  return process.env.PINTEREST_BOARD_CAPSULE;
  if (p.includes('tech') || p.includes('ai'))        return process.env.PINTEREST_BOARD_FASHIONTECH;
  return process.env.PINTEREST_BOARD_OUTFIT;
}

module.exports = { getBoardForPillar };
