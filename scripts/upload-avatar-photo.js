// upload-avatar-photo.js
// Uploads the Bons Stylist avatar photo to HeyGen to get a fresh image_key.
// Run this if HEYGEN_IMAGE_KEY in .env stops working (keys can expire).
// Run: node scripts/upload-avatar-photo.js
//
// The Bons Stylist avatar is a "talking photo" stored in HeyGen.
// Group ID: 36d86455fdd743a2a22b7bdd20633e85
// Look ID:  b96d8b3f058e4096a9e2ec7666fce834

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const GROUP_ID = '36d86455fdd743a2a22b7bdd20633e85';

async function getAvatarImageUrl() {
  const resp = await fetch(`https://api2.heygen.com/v2/avatar_group/look.list?group_id=${GROUP_ID}`, {
    headers: { 'X-Api-Key': HEYGEN_API_KEY },
  });
  const data = await resp.json();
  const look = data?.data?.avatar_looks?.[0]?.look;
  if (!look?.image_url) throw new Error('Could not find avatar image_url from HeyGen API');
  return look.image_url;
}

async function main() {
  console.log('\n📸 BONS AVATAR PHOTO UPLOADER');
  console.log('━'.repeat(40));

  console.log('  Fetching Bons Stylist avatar image URL...');
  const imageUrl = await getAvatarImageUrl();
  console.log('  ✅ Found avatar image');

  console.log('  Downloading image...');
  const imgResp = await fetch(imageUrl);
  const arrayBuffer = await imgResp.arrayBuffer();

  // Try JPEG first; fall back to PNG
  const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
  const uploadType = contentType.includes('webp') ? 'image/jpeg' : contentType;

  console.log('  Uploading to HeyGen asset storage...');
  const uploadResp = await fetch('https://upload.heygen.com/v1/asset', {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': uploadType,
    },
    body: Buffer.from(arrayBuffer),
  });

  const uploadData = await uploadResp.json();
  if (!uploadData.data?.image_key) {
    console.error('❌ Upload failed:', JSON.stringify(uploadData, null, 2));
    process.exit(1);
  }

  const imageKey = uploadData.data.image_key;
  console.log(`\n✅ Image uploaded! image_key:\n`);
  console.log(`   ${imageKey}\n`);
  console.log('Add this to your .env file:');
  console.log(`   HEYGEN_IMAGE_KEY=${imageKey}\n`);

  // Auto-update .env if possible
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('HEYGEN_IMAGE_KEY=')) {
      envContent = envContent.replace(/HEYGEN_IMAGE_KEY=.*/g, `HEYGEN_IMAGE_KEY=${imageKey}`);
    } else {
      envContent = envContent.replace(
        /HEYGEN_VOICE_ID=.*/,
        `HEYGEN_VOICE_ID=${process.env.HEYGEN_VOICE_ID || 'TYsaKjytlhBgNFyzhioU'}\n# Avatar IV image key — Bons Stylist photo uploaded to HeyGen asset storage\nHEYGEN_IMAGE_KEY=${imageKey}`
      );
    }
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env updated automatically.\n');
  }
}

main().catch(console.error);
