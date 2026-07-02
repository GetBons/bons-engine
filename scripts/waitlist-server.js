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

const WELCOME_SUBJECT = "You're in — welcome to Bons 🤍";

const WELCOME_BODY = `Hi there,

You're officially on the Bons waitlist — thank you for joining us this early.

Here's a little bit about what we're building: Bons uses AI to help you actually use what's already in your closet. Photograph your clothes once, and Bons builds outfits you'd never have thought to put together — no new shopping required (unless you want to).

We started this because we were tired of staring into a full closet and feeling like we had nothing to wear. If that sounds familiar, you're going to love this.

A few things to expect:
— Early access before the public launch
— Behind-the-scenes updates as we build
— First look at new features before anyone else

We're building this in public, which means you'll see the real journey — the wins, the hard parts, all of it. Follow along on TikTok, Instagram, and Pinterest @get_bons.

Talk soon,
The Bons Team

P.S. — Got a friend who's always saying "I have nothing to wear"? Forward this along. The earlier they join, the earlier they get in.`;

async function sendWelcomeEmail(email) {
  await resend.emails.send({
    from:    'The Bons Team <hello@getbons.com>',
    to:      email,
    subject: WELCOME_SUBJECT,
    text:    WELCOME_BODY
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
