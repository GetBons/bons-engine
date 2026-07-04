require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { Resend } = require('resend');
const fs         = require('fs-extra');
// juice removed — HTML is fully inline-styled, no post-processing needed

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
<title>Welcome to Bons</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ece5;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ece5;">
<tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#f7f4ef;">

  <!-- HEADER -->
  <tr><td bgcolor="#1a1814" align="center" style="background-color:#1a1814;padding:32px 48px 28px;">
    <span style="font-family:Georgia,serif;font-style:italic;font-size:36px;color:#b89a6a;letter-spacing:3px;display:block;margin-bottom:6px;">bons</span>
    <table width="80" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;"><tr><td height="1" bgcolor="#b89a6a" style="background-color:#b89a6a;opacity:0.3;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <span style="font-family:Georgia,serif;font-size:9px;color:#b89a6a;letter-spacing:6px;text-transform:uppercase;opacity:0.5;">Style</span>
  </td></tr>

  <!-- GOLD BAND -->
  <tr><td bgcolor="#b89a6a" align="center" style="background-color:#b89a6a;padding:14px 48px;">
    <span style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#1a1814;letter-spacing:0.5px;">You are the occasion. Wear the outfit.</span>
  </td></tr>

  <!-- BODY -->
  <tr><td bgcolor="#f7f4ef" style="background-color:#f7f4ef;padding:48px 48px 36px;">
    <p style="font-family:Georgia,serif;font-size:9px;color:#b89a6a;letter-spacing:5px;text-transform:uppercase;margin:0 0 20px 0;">Welcome to Bons</p>
    <h1 style="font-family:Georgia,serif;font-style:italic;font-size:28px;color:#1a1814;line-height:1.2;margin:0 0 24px 0;letter-spacing:-0.3px;">Your good things<br>are waiting for you.</h1>
    <table width="40" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td height="1" bgcolor="#b89a6a" style="background-color:#b89a6a;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="font-family:Georgia,serif;font-size:15px;color:#3d3a36;line-height:1.85;margin:0 0 20px 0;">You just did something most people never do &mdash; you decided that getting dressed in the morning should feel good. Not stressful. Not frantic. Not another decision to make before you&rsquo;ve had your coffee.</p>
    <p style="font-family:Georgia,serif;font-size:15px;color:#3d3a36;line-height:1.85;margin:0 0 20px 0;">Bons is your AI wardrobe stylist. She knows every piece you own, remembers what you love, and builds outfits from what you already have &mdash; every single morning. She checks the weather so you&rsquo;re never caught off guard, and she syncs with your calendar so every outfit is built for your actual day &mdash; the board meeting, the school run, the dinner. No shopping required. No decision fatigue. Just your wardrobe, finally working for you.</p>
    <p style="font-family:Georgia,serif;font-style:italic;font-size:15px;color:#1a1814;line-height:1.85;margin:0 0 20px 0;">&ldquo;Your closet is full of good things. We just help you find them.&rdquo;</p>
    <p style="font-family:Georgia,serif;font-size:15px;color:#3d3a36;line-height:1.85;margin:0;">We&rsquo;re building Bons right now and you&rsquo;re on the inside. That means you&rsquo;ll be among the first to try it, shape it, and own your rate before the world finds out about it.</p>
  </td></tr>

  <!-- WHAT HAPPENS NEXT -->
  <tr><td bgcolor="#1a1814" style="background-color:#1a1814;padding:36px 48px;">
    <p style="font-family:Georgia,serif;font-size:9px;color:#b89a6a;letter-spacing:5px;text-transform:uppercase;margin:0 0 20px 0;opacity:0.6;">What happens next</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td width="32" valign="top" style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#b89a6a;opacity:0.3;line-height:1.2;padding-right:12px;">01</td>
        <td valign="top">
          <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#b89a6a;margin:0 0 3px 0;letter-spacing:0.3px;">You&rsquo;re on the list</p>
          <p style="font-family:Georgia,serif;font-size:12px;color:#f7f4ef;line-height:1.7;margin:0;opacity:0.45;">Your spot is confirmed. You&rsquo;ll hear from us before anyone else when Bons is ready to launch.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td width="32" valign="top" style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#b89a6a;opacity:0.3;line-height:1.2;padding-right:12px;">02</td>
        <td valign="top">
          <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#b89a6a;margin:0 0 3px 0;letter-spacing:0.3px;">Beta access &mdash; first</p>
          <p style="font-family:Georgia,serif;font-size:12px;color:#f7f4ef;line-height:1.7;margin:0;opacity:0.45;">Waitlist members get early access to the beta before the public launch. You&rsquo;ll help shape how Bons works.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td width="32" valign="top" style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#b89a6a;opacity:0.3;line-height:1.2;padding-right:12px;">03</td>
        <td valign="top">
          <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#b89a6a;margin:0 0 3px 0;letter-spacing:0.3px;">You joined early</p>
          <p style="font-family:Georgia,serif;font-size:12px;color:#f7f4ef;line-height:1.7;margin:0;opacity:0.45;">Being on the waitlist means you get priority access, exclusive early member benefits, and a say in how Bons is shaped before the world sees it.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td width="32" valign="top" style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#b89a6a;opacity:0.3;line-height:1.2;padding-right:12px;">04</td>
        <td valign="top">
          <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#b89a6a;margin:0 0 3px 0;letter-spacing:0.3px;">Dressed for the weather</p>
          <p style="font-family:Georgia,serif;font-size:12px;color:#f7f4ef;line-height:1.7;margin:0;opacity:0.45;">Bons syncs with your local weather every morning so every outfit suggestion is appropriate for the day ahead &mdash; not just stylish, but practical.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td width="32" valign="top" style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#b89a6a;opacity:0.3;line-height:1.2;padding-right:12px;">05</td>
        <td valign="top">
          <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#b89a6a;margin:0 0 3px 0;letter-spacing:0.3px;">Built around your day</p>
          <p style="font-family:Georgia,serif;font-size:12px;color:#f7f4ef;line-height:1.7;margin:0;opacity:0.45;">Bons connects to your calendar so your stylist knows what you have ahead &mdash; a board meeting, a lunch, a school run, a dinner. Every outfit is built for your actual day, not a generic one.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="32" valign="top" style="font-family:Georgia,serif;font-style:italic;font-size:22px;color:#b89a6a;opacity:0.3;line-height:1.2;padding-right:12px;">06</td>
        <td valign="top">
          <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#b89a6a;margin:0 0 3px 0;letter-spacing:0.3px;">Updates from Bons</p>
          <p style="font-family:Georgia,serif;font-size:12px;color:#f7f4ef;line-height:1.7;margin:0;opacity:0.45;">Your AI stylist inside Bons will send you occasional notes as we build &mdash; style tips, behind the scenes, and things worth knowing.</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td bgcolor="#f7f4ef" align="center" style="background-color:#f7f4ef;padding:40px 48px;">
    <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#3d3a36;line-height:1.75;margin:0 0 28px 0;">Follow along as we build. Every post, every update,<br>every outfit idea &mdash; it&rsquo;s all happening at <strong style="color:#1a1814;">@get.bons</strong>.</p>
    <a href="https://www.instagram.com/get.bons" style="display:inline-block;background-color:#1a1814;color:#b89a6a;font-family:Georgia,serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;padding:16px 40px;text-decoration:none;">Follow @get.bons</a>
    <p style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:11px;color:#1a1814;letter-spacing:1px;opacity:0.4;">Instagram &nbsp;&middot;&nbsp; TikTok &nbsp;&middot;&nbsp; Pinterest &nbsp;&middot;&nbsp; X</p>
  </td></tr>

  <!-- MANIFESTO -->
  <tr><td bgcolor="#b89a6a" align="center" style="background-color:#b89a6a;padding:32px 48px;">
    <p style="font-family:Georgia,serif;font-style:italic;font-size:17px;color:#1a1814;line-height:1.5;letter-spacing:0.3px;margin:0;">You are the occasion.<br>Wear the outfit.</p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td bgcolor="#1a1814" align="center" style="background-color:#1a1814;padding:28px 48px;">
    <span style="font-family:Georgia,serif;font-style:italic;font-size:18px;color:#b89a6a;letter-spacing:2px;display:block;margin-bottom:14px;opacity:0.6;">bons</span>
    <p style="margin:0 0 14px 0;">
      <a href="https://getbons.com" style="font-family:Georgia,serif;font-size:10px;color:#f7f4ef;letter-spacing:2px;text-decoration:none;margin:0 10px;opacity:0.3;">getbons.com</a>
      <a href="mailto:hello@getbons.com" style="font-family:Georgia,serif;font-size:10px;color:#f7f4ef;letter-spacing:2px;text-decoration:none;margin:0 10px;opacity:0.3;">hello@getbons.com</a>
    </p>
    <p style="font-family:Georgia,serif;font-size:10px;color:#f7f4ef;letter-spacing:0.5px;line-height:1.6;margin:0 0 10px 0;opacity:0.2;">&copy; 2026 Bons. Your good things.<br>Franklin, Tennessee</p>
    <p style="font-family:Georgia,serif;font-size:9px;color:#f7f4ef;letter-spacing:0.5px;margin:0;opacity:0.15;">You&rsquo;re receiving this because you joined the Bons waitlist.<br><a href="#" style="color:#f7f4ef;text-decoration:underline;opacity:0.2;">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr>
</table>
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
