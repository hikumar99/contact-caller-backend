// server.js - Simple backend for Render deployment
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for now
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Get credentials from environment variable
let credentials = null;

try {
  if (process.env.GOOGLE_CREDENTIALS) {
    // For production (Render)
    credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString()
    );
    console.log('✅ Loaded credentials from environment');
  } else {
    console.log('⚠️  No credentials found in environment');
  }
} catch (error) {
  console.error('❌ Error loading credentials:', error.message);
}

// Initialize Google Sheets API
const authorize = async () => {
  if (!credentials) {
    throw new Error('Google credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth.getClient();
};

const sheets = google.sheets('v4');

// Extract spreadsheet ID from URL
const extractSpreadsheetId = (url) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Contact Caller Backend is running! 🚀',
    timestamp: new Date().toISOString(),
    hasCredentials: !!credentials,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    hasCredentials: !!credentials 
  });
});

// Get contacts from spreadsheet
app.post('/api/contacts', async (req, res) => {
  try {
    console.log('📞 Fetching contacts from spreadsheet...');
    const { spreadsheetUrl } = req.body;
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Invalid spreadsheet URL' });
    }

    const auth = await authorize();
    
    // Read data from the sheet
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: 'Sheet1!A:D', // Columns A-D
    });

    const rows = response.data.values || [];
    console.log(`📊 Found ${rows.length} rows in spreadsheet`);
    
    if (rows.length === 0) {
      return res.json({ contacts: [] });
    }

    // Parse the data
    const headers = rows[0];
    const contacts = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const contact = {};
      
      headers.forEach((header, index) => {
        contact[header] = row[index] || '';
      });
      
      // Only include contacts that haven't been completed and have a phone number
      if (contact.contact && contact.contact.trim() !== '' && 
          (!contact.CompletedBy || contact.CompletedBy.trim() === '')) {
        contact.rowIndex = i + 1; // Store the row index for updates (1-based)
        contacts.push(contact);
      }
    }

    // Shuffle contacts for random distribution
    const shuffledContacts = contacts.sort(() => Math.random() - 0.5);
    console.log(`✅ Returning ${shuffledContacts.length} available contacts`);
    
    res.json({ contacts: shuffledContacts });

  } catch (error) {
    console.error('❌ Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update contact as completed
app.post('/api/complete', async (req, res) => {
  try {
    console.log('✍️  Marking contact as complete...');
    const { spreadsheetUrl, rowIndex, completedBy } = req.body;
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Invalid spreadsheet URL' });
    }

    const auth = await authorize();
    
    // Create timestamp in Indian timezone
    const now = new Date();
    const istTime = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);

    console.log(`📝 Updating row ${rowIndex} for ${completedBy}`);

    // Update the CompletedBy and CompletedAt columns
    const updateRequests = [
      {
        range: `Sheet1!C${rowIndex}`, // CompletedBy column (C)
        values: [[completedBy]]
      },
      {
        range: `Sheet1!D${rowIndex}`, // CompletedAt column (D)
        values: [[istTime]]
      }
    ];

    await sheets.spreadsheets.values.batchUpdate({
      auth,
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updateRequests
      }
    });

    console.log('✅ Successfully updated spreadsheet');
    res.json({ 
      success: true, 
      message: `Contact marked as completed by ${completedBy}`,
      completedAt: istTime
    });

  } catch (error) {
    console.error('❌ Error updating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test spreadsheet connection
app.post('/api/test', async (req, res) => {
  try {
    const { spreadsheetUrl } = req.body;
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Invalid spreadsheet URL' });
    }

    const auth = await authorize();
    
    // Try to read the header row
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: 'Sheet1!A1:D1',
    });

    res.json({ 
      success: true, 
      message: 'Successfully connected to spreadsheet! 🎉',
      headers: response.data.values ? response.data.values[0] : []
    });

  } catch (error) {
    console.error('❌ Error testing connection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/health', 
      'POST /api/contacts',
      'POST /api/complete',
      'POST /api/test'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Contact Caller Backend Server Started!`);
  console.log(`📍 Running on port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Credentials: ${credentials ? '✅ Loaded' : '❌ Missing'}`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  
  if (!credentials) {
    console.log('\n⚠️  WARNING: Google credentials not found!');
    console.log('Make sure GOOGLE_CREDENTIALS environment variable is set');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully');  
  process.exit(0);
});