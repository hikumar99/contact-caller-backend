// server.js - Updated for Contact | Status | CompletedBy | CompletedAt
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS ---
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length === 0) {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:3000');
}
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin ${origin} not allowed`), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// --- Google Auth ---
let credentials = null;
try {
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentialsString = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString();
    credentials = JSON.parse(credentialsString);
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid credentials: missing required fields');
    }
    console.log('✅ Loaded credentials');
  } else {
    console.log('⚠️ No GOOGLE_CREDENTIALS env var found');
  }
} catch (error) {
  console.error('❌ Error loading credentials:', error.message);
  credentials = null;
}

const authorize = async () => {
  if (!credentials) throw new Error('Google credentials not configured properly');
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
};
const sheets = google.sheets('v4');

// Extract spreadsheet ID
const extractSpreadsheetId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    hasCredentials: !!credentials,
    uptime: process.uptime()
  });
});

// Get contacts
app.post('/api/contacts', async (req, res) => {
  try {
    const { spreadsheetUrl } = req.body;
    if (!spreadsheetUrl) return res.status(400).json({ error: 'Spreadsheet URL is required' });

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) return res.status(400).json({ error: 'Invalid spreadsheet URL format' });

    const auth = await authorize();
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: 'Sheet1!A:D', // Contact | Status | CompletedBy | CompletedAt
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ contacts: [], message: 'No contact data found' });
    }

    // Normalize headers
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const contacts = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const contact = {};

      // Ensure row has 4 columns
      while (row.length < headers.length) {
        row.push('');
      }

      headers.forEach((header, index) => {
        let value = row[index] || '';
        if (typeof value === 'string') value = value.trim();
        contact[header] = value;
      });

      // ✅ filter only pending
      const hasContact = contact['contact'] && contact['contact'] !== '';
      const status = contact['status'] ? contact['status'].toLowerCase() : 'pending';
      const isPending = status === 'pending';

      if (hasContact && isPending) {
        contact.rowIndex = i + 1;
        contacts.push(contact);
      }
    }

    console.log(`📊 Found ${rows.length - 1} rows in spreadsheet`);
    console.log(`✅ Returning ${contacts.length} pending contacts`);
    res.json({ contacts });
  } catch (error) {
    console.error('❌ Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete contact
app.post('/api/complete', async (req, res) => {
  try {
    const { spreadsheetUrl, rowIndex, completedBy } = req.body;
    if (!spreadsheetUrl || !rowIndex || !completedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) return res.status(400).json({ error: 'Invalid spreadsheet URL format' });

    const auth = await authorize();

    const now = new Date();
    const istTime = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(now);

    const updateRequests = [
      { range: `Sheet1!B${rowIndex}`, values: [['Completed']] },   // Status
      { range: `Sheet1!C${rowIndex}`, values: [[completedBy]] },   // CompletedBy
      { range: `Sheet1!D${rowIndex}`, values: [[istTime]] }        // CompletedAt
    ];

    await sheets.spreadsheets.values.batchUpdate({
      auth,
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data: updateRequests }
    });

    res.json({ success: true, message: `Contact marked as completed by ${completedBy}`, completedAt: istTime });
  } catch (error) {
    console.error('❌ Error updating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test spreadsheet
app.post('/api/test', async (req, res) => {
  try {
    const { spreadsheetUrl } = req.body;
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) return res.status(400).json({ error: 'Invalid spreadsheet URL format' });

    const auth = await authorize();
    const response = await sheets.spreadsheets.get({
      auth,
      spreadsheetId,
    });

    res.json({ success: true, title: response.data.properties.title });
  } catch (error) {
    console.error('❌ Error testing spreadsheet:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
