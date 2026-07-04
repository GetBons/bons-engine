require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { Resend } = require('resend');
const fs         = require('fs-extra');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ── Google Sheets ─────────────────────────────────────────────────────────
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function getSheetClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes:  ['https://www.googleapis.com/auth/spreadsheets']
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function addToSheet(email) {
  const sheets = await getSheetClient();
  const today  = new Date().toISOString().split('T')[0];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range:         'Sheet1!A:D',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[email, today, 'Bons Waitlist', 'Pending']] }
  });
  console.log(`  📊 Added ${email} to Google Sheet`);
}

async function markEmailSent(email) {
  const sheets = await getSheetClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:D'
  });
  const rows     = result.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === email);
  if (rowIndex !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range:         `Sheet1!D${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Sent']] }
    });
  }
}

// ── Email ─────────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const WELCOME_SUBJECT = "Your good things are waiting for you.";

const WELCOME_TEXT = `Welcome to Bons.

You just did something most people never do — you decided that getting dressed in the morning should feel good.

Bons is your AI wardrobe stylist. She knows every piece you own, remembers what you love, and builds outfits from what you already have — every single morning.

What happens next:
01 — You're on the list. You'll hear from us before anyone else when Bons is ready to launch.
02 — Beta access first. Waitlist members get early access before the public launch.
03 — You joined early. Priority access, exclusive early member benefits, and a say in how Bons is shaped.

Follow along as we build: instagram.com/get.bons

You are the occasion. Wear the outfit.
— The Bons Team`;

const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to Bons</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 0; padding: 0; background-color: #f0ece5; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
  img { border: 0; display: block; outline: none; }
  a { text-decoration: none; }
  .email-wrapper { background-color: #f0ece5; padding: 40px 20px; width: 100%; }
  .email-container { max-width: 560px; margin: 0 auto; background-color: #f7f4ef; }
  .header { background-color: #1a1814; padding: 32px 48px 28px; text-align: center; }
  .header-wordmark { font-family: Georgia, serif; font-style: italic; font-size: 36px; color: #b89a6a; letter-spacing: 3px; display: block; margin-bottom: 6px; }
  .header-rule { width: 80px; height: 0.5px; background-color: rgba(184,154,106,0.3); margin: 0 auto 8px; }
  .header-sub { font-family: Georgia, serif; font-size: 9px; color: rgba(184,154,106,0.5); letter-spacing: 6px; text-transform: uppercase; }
  .gold-band { background-color: #b89a6a; padding: 14px 48px; text-align: center; }
  .gold-band-text { font-family: Georgia, serif; font-style: italic; font-size: 13px; color: #1a1814; letter-spacing: 0.5px; }
  .body-section { padding: 48px 48px 36px; }
  .eyebrow { font-family: Georgia, serif; font-size: 9px; color: #b89a6a; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 20px; }
  .headline { font-family: Georgia, serif; font-style: italic; font-size: 28px; color: #1a1814; line-height: 1.2; margin-bottom: 24px; letter-spacing: -0.3px; }
  .body-rule { width: 40px; height: 0.5px; background-color: #b89a6a; margin-bottom: 24px; }
  .body-text { font-family: Georgia, serif; font-size: 15px; color: #3d3a36; line-height: 1.85; margin-bottom: 20px; }
  .body-text-italic { font-family: Georgia, serif; font-style: italic; font-size: 15px; color: #1a1814; line-height: 1.85; margin-bottom: 20px; }
  .next-section { background-color: #1a1814; padding: 36px 48px; }
  .next-eyebrow { font-family: Georgia, serif; font-size: 9px; color: rgba(184,154,106,0.6); letter-spacing: 5px; text-transform: uppercase; margin-bottom: 20px; }
  .next-item { display: flex; margin-bottom: 20px; align-items: flex-start; }
  .next-num { font-family: Georgia, serif; font-style: italic; font-size: 22px; color: rgba(184,154,106,0.3); min-width: 32px; line-height: 1.2; margin-top: -2px; }
  .next-title { font-family: Georgia, serif; font-style: italic; font-size: 14px; color: #b89a6a; margin-bottom: 3px; letter-spacing: 0.3px; }
  .next-desc { font-family: Georgia, serif; font-size: 12px; color: rgba(247,244,239,0.45); line-height: 1.7; }
  .cta-section { padding: 40px 48px; text-align: center; background-color: #f7f4ef; }
  .cta-text { font-family: Georgia, serif; font-style: italic; font-size: 14px; color: #3d3a36; line-height: 1.75; margin-bottom: 28px; }
  .cta-btn { display: inline-block; background-color: #1a1814; color: #b89a6a; font-family: Georgia, serif; font-size: 10px; letter-spacing: 4px; text-transform: uppercase; padding: 16px 40px; text-decoration: none; }
  .manifesto-section { background-color: #b89a6a; padding: 32px 48px; text-align: center; }
  .manifesto-line { font-family: Georgia, serif; font-style: italic; font-size: 17px; color: #1a1814; line-height: 1.5; letter-spacing: 0.3px; }
  .footer { background-color: #1a1814; padding: 28px 48px; text-align: center; }
  .footer-wordmark { font-family: Georgia, serif; font-style: italic; font-size: 18px; color: rgba(184,154,106,0.6); letter-spacing: 2px; display: block; margin-bottom: 14px; }
  .footer-links { margin-bottom: 14px; }
  .footer-link { font-family: Georgia, serif; font-size: 10px; color: rgba(247,244,239,0.3); letter-spacing: 2px; text-decoration: none; margin: 0 10px; }
  .footer-copy { font-family: Georgia, serif; font-size: 10px; color: rgba(247,244,239,0.2); letter-spacing: 0.5px; line-height: 1.6; }
  .footer-unsub { font-family: Georgia, serif; font-size: 9px; color: rgba(247,244,239,0.15); margin-top: 10px; letter-spacing: 0.5px; }
  @media only screen and (max-width: 480px) {
    .body-section, .next-section, .cta-section, .manifesto-section, .footer, .header, .gold-band { padding-left: 24px !important; padding-right: 24px !important; }
    .headline { font-size: 22px !important; }
    .header-wordmark { font-size: 28px !important; }
  }
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-container">
  <div class="header">
    <span class="header-wordmark">bons</span>
    <div class="header-rule"></div>
    <span class="header-sub">Style</span>
  </div>
  <div class="gold-band">
    <span class="gold-band-text">You are the occasion. Wear the outfit.</span>
  </div>
  <div class="body-section">
    <p class="eyebrow">Welcome to Bons</p>
    <h1 class="headline">Your good things<br>are waiting for you.</h1>
    <div class="body-rule"></div>
    <p class="body-text">You just did something most people never do — you decided that getting dressed in the morning should feel good. Not stressful. Not frantic. Not another decision to make before you've had your coffee.</p>
    <p class="body-text">Bons is your AI wardrobe stylist. She knows every piece you own, remembers what you love, and builds outfits from what you already have — every single morning. She checks the weather so you're never caught off guard, and she syncs with your calendar so every outfit is built for your actual day — the board meeting, the school run, the dinner. No shopping required. No decision fatigue. Just your wardrobe, finally working for you.</p>
    <p class="body-text-italic">"Your closet is full of good things. We just help you find them."</p>
    <p class="body-text">We're building Bons right now and you're on the inside. That means you'll be among the first to try it, shape it, and own your rate before the world finds out about it.</p>
  </div>
  <div class="next-section">
    <p class="next-eyebrow">What happens next</p>
    <div class="next-item">
      <div class="next-num">01</div>
      <div class="next-content">
        <p class="next-title">You're on the list</p>
        <p class="next-desc">Your spot is confirmed. You'll hear from us before anyone else when Bons is ready to launch.</p>
      </div>
    </div>
    <div class="next-item">
      <div class="next-num">02</div>
      <div class="next-content">
        <p class="next-title">Beta access — first</p>
        <p class="next-desc">Waitlist members get early access to the beta before the public launch. You'll help shape how Bons works.</p>
      </div>
    </div>
    <div class="next-item">
      <div class="next-num">03</div>
      <div class="next-content">
        <p class="next-title">You joined early</p>
        <p class="next-desc">Being on the waitlist means you get priority access, exclusive early member benefits, and a say in how Bons is shaped before the world sees it.</p>
      </div>
    </div>
    <div class="next-item">
      <div class="next-num">04</div>
      <div class="next-content">
        <p class="next-title">Dressed for the weather</p>
        <p class="next-desc">Bons syncs with your local weather every morning so every outfit suggestion is appropriate for the day ahead — not just stylish, but practical.</p>
      </div>
    </div>
    <div class="next-item">
      <div class="next-num">05</div>
      <div class="next-content">
        <p class="next-title">Built around your day</p>
        <p class="next-desc">Bons connects to your calendar so your stylist knows what you have ahead — a board meeting, a lunch, a school run, a dinner. Every outfit is built for your actual day, not a generic one.</p>
      </div>
    </div>
    <div class="next-item" style="margin-bottom:0">
      <div class="next-num">06</div>
      <div class="next-content">
        <p class="next-title">Updates from Bons</p>
        <p class="next-desc">Your AI stylist inside Bons will send you occasional notes as we build — style tips, behind the scenes, and things worth knowing.</p>
      </div>
    </div>
  </div>
  <div class="cta-section">
    <p class="cta-text">Follow along as we build. Every post, every update,<br>every outfit idea — it's all happening at <strong style="color:#1a1814">@get.bons</strong>.</p>
    <a href="https://www.instagram.com/get.bons" class="cta-btn">Follow @get.bons</a>
    <p style="margin-top: 16px; font-family: Georgia, serif; font-size: 11px; color: rgba(26,24,20,0.4); letter-spacing: 1px;">Instagram &nbsp;·&nbsp; TikTok &nbsp;·&nbsp; Pinterest &nbsp;·&nbsp; X</p>
  </div>
  <div class="manifesto-section">
    <p class="manifesto-line">You are the occasion.</p>
    <p class="manifesto-line">Wear the outfit.</p>
  </div>
  <div class="footer">
    <span class="footer-wordmark">bons</span>
    <div class="footer-links">
      <a href="https://getbons.com" class="footer-link">getbons.com</a>
      <a href="mailto:hello@getbons.com" class="footer-link">hello@getbons.com</a>
    </div>
    <p class="footer-copy">© 2026 Bons. Your good things.<br>Franklin, Tennessee</p>
    <p class="footer-unsub">You're receiving this because you joined the Bons waitlist.<br><a href="#" style="color: rgba(247,244,239,0.2); text-decoration: underline;">Unsubscribe</a></p>
  </div>
</div>
</div>
</body>
</html>`;

async function sendWelcomeEmail(email) {
  await resend.emails.send({
    from:    'Bons <hello@getbons.com>',
    to:      email,
    subject: WELCOME_SUBJECT,
    html:    WELCOME_HTML,
    text:    WELCOME_TEXT,
  });
  console.log(`  📧 Welcome email sent to ${email}`);
}

// ── Webhook endpoint ──────────────────────────────────────────────────────
app.post('/waitlist-signup', async (req, res) => {
  try {
    const email = req.body.email || req.body.Email;
    if (!email) {
      console.log('  ⚠️  No email found in submission');
      return res.status(400).send('No email provided');
    }

    console.log(`\n🆕 New Bons signup: ${email}`);
    await addToSheet(email);
    await sendWelcomeEmail(email);
    await markEmailSent(email);
    console.log(`  ✅ Fully processed: ${email}\n`);
    res.status(200).send('OK');

  } catch (error) {
    console.error('  ❌ Error:', error.message);
    res.status(500).send('Error');
  }
});

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('Bons waitlist server is running ✅');
});

app.listen(PORT, () => {
  console.log(`\n🚀 Bons waitlist server running on port ${PORT}`);
  console.log(`📍 Webhook URL: http://localhost:${PORT}/waitlist-signup\n`);
});
