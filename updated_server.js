// server.js - Updated with proper CORS, env-driven origins, and case-insensitive headers
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS (env-driven) ---
const rawOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

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

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Credentials
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

// Google Sheets API
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
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/spreadsheets\/u\/\d+\/d\/([a-zA-Z0-9-_]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/edit/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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
      range: 'Sheet1!A:C', // ✅ only 3 columns
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ contacts: [], message: 'No contact data found' });
    }

    // Case-insensitive headers
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const contacts = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const contact = {};
      headers.forEach((header, index) => {
        contact[header] = row[index] || '';
      });

      const hasContact = contact['contact'] && contact['contact'].trim() !== '';
      const notCompleted = !contact['completedby'] || contact['completedby'].trim() === '';

      if (hasContact) {
        contact.rowIndex = i + 1; // 1-based index
        contact.isCompleted = !notCompleted; // mark if already completed
        if (notCompleted) {
          contacts.push(contact); // only show available ones
        }
      }
    }

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
      { range: `Sheet1!B${rowIndex}`, values: [[completedBy]] }, // ✅ CompletedBy = col B
      { range: `Sheet1!C${rowIndex}`, values: [[istTime]] }      // ✅ CompletedAt = col C
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
    if (!spreadsheetId) return res.status(400).json({ error: 'Invalid spreadsheet URL' });

    const auth = await authorize();
    const meta = await sheets.spreadsheets.get({ auth, spreadsheetId });
    res.json({ success: true, spreadsheetTitle: meta.data.properties.title });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
