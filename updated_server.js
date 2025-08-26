// server.js - Updated with proper CORS and error handling
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'https://comforting-twilight-9f6115.netlify.app',
    'https://68ad727ac01d4717de57673c--comforting-twilight-9f6115.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Get credentials from environment variable with better error handling
let credentials = null;

try {
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentialsString = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString();
    credentials = JSON.parse(credentialsString);
    console.log('✅ Loaded credentials from environment');
    
    // Validate required fields
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid credentials: missing required fields');
    }
  } else {
    console.log('⚠️  No GOOGLE_CREDENTIALS environment variable found');
  }
} catch (error) {
  console.error('❌ Error loading credentials:', error.message);
  credentials = null;
}

// Initialize Google Sheets API
const authorize = async () => {
  if (!credentials) {
    throw new Error('Google credentials not configured properly');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return auth.getClient();
};

const sheets = google.sheets('v4');

// Extract spreadsheet ID from URL with better validation
const extractSpreadsheetId = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  // Handle different Google Sheets URL formats
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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Contact Caller Backend is running! 🚀',
    timestamp: new Date().toISOString(),
    hasCredentials: !!credentials,
    environment: process.env.NODE_ENV || 'development',
    version: '1.1.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    hasCredentials: !!credentials,
    uptime: process.uptime()
  });
});

// Get contacts from spreadsheet
app.post('/api/contacts', async (req, res) => {
  try {
    console.log('📞 Fetching contacts from spreadsheet...');
    const { spreadsheetUrl } = req.body;
    
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'Spreadsheet URL is required' });
    }
    
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      return res.status(400).json({ 
        error: 'Invalid spreadsheet URL format. Please use a valid Google Sheets URL.' 
      });
    }

    const auth = await authorize();
    
    // Read data from the sheet with error handling
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: 'Sheet1!A:D',
      });
    } catch (sheetError) {
      console.error('Sheet access error:', sheetError.message);
      if (sheetError.message.includes('not found')) {
        return res.status(404).json({ 
          error: 'Spreadsheet not found. Please check the URL and sharing permissions.' 
        });
      }
      if (sheetError.message.includes('permission')) {
        return res.status(403).json({ 
          error: 'Permission denied. Please share the spreadsheet with the service account email.' 
        });
      }
      throw sheetError;
    }

    const rows = response.data.values || [];
    console.log(`📊 Found ${rows.length} rows in spreadsheet`);
    
    if (rows.length === 0) {
      return res.json({ contacts: [], message: 'No data found in spreadsheet' });
    }

    if (rows.length === 1) {
      return res.json({ contacts: [], message: 'Only headers found, no contact data' });
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
      
      // Only include contacts that haven't been completed and have required data
      const hasContact = contact.contact && contact.contact.trim() !== '';
      const notCompleted = !contact.CompletedBy || contact.CompletedBy.trim() === '';
      
      if (hasContact && notCompleted) {
        contact.rowIndex = i + 1; // Store the row index for updates (1-based)
        contacts.push(contact);
      }
    }

    // Shuffle contacts for random distribution
    const shuffledContacts = contacts.sort(() => Math.random() - 0.5);
    console.log(`✅ Returning ${shuffledContacts.length} available contacts`);
    
    res.json({ 
      contacts: shuffledContacts,
      totalRows: rows.length - 1,
      availableContacts: shuffledContacts.length
    });

  } catch (error) {
    console.error('❌ Error fetching contacts:', error);
    res.status(500).json({ 
      error: 'Internal server error while fetching contacts',
      details: error.message 
    });
  }
});

// Update contact as completed
app.post('/api/complete', async (req, res) => {
  try {
    console.log('✏️ Marking contact as complete...');
    const { spreadsheetUrl, rowIndex, completedBy } = req.body;
    
    if (!spreadsheetUrl || !rowIndex || !completedBy) {
      return res.status(400).json({ 
        error: 'Missing required fields: spreadsheetUrl, rowIndex, and completedBy' 
      });
    }
    
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Invalid spreadsheet URL format' });
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
      completedAt: istTime,
      rowIndex
    });

  } catch (error) {
    console.error('❌ Error updating contact:', error);
    res.status(500).json({ 
      error: 'Failed to update contact',
      details: error.message 
    });
  }
});

// Test spreadsheet connection
app.post('/api/test', async (req, res) => {
  try {
    const { spreadsheetUrl } = req.body;
    
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'Spreadsheet URL is required' });
    }
    
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Invalid spreadsheet URL format' });
    }

    const auth = await authorize();
    
    // Try to read the spreadsheet info and header row
    const [metaResponse, dataResponse] = await Promise.all([
      sheets.spreadsheets.get({ auth, spreadsheetId }),
      sheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: 'Sheet1!A1:D1',
      })
    ]);

    const sheetTitle = metaResponse.data.properties.title;
    const headers = dataResponse.data.values ? dataResponse.data.values[0] : [];

    res.json({ 
      success: true, 
      message: 'Successfully connected to spreadsheet! 🎉',
      spreadsheetTitle: sheetTitle,
      headers,
      spreadsheetId
    });

  } catch (error) {
    console.error('❌ Error testing connection:', error);
    
    let errorMessage = 'Failed to connect to spreadsheet';
    if (error.message.includes('not found')) {
      errorMessage = 'Spreadsheet not found. Check the URL and sharing permissions.';
    } else if (error.message.includes('permission')) {
      errorMessage = 'Permission denied. Share the spreadsheet with the service account.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Contact Caller Backend Server Started!`);
  console.log(`🌐 Running on port: ${PORT}`);
  console.log(`🏃 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Credentials: ${credentials ? '✅ Loaded' : '❌ Missing'}`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  
  if (credentials) {
    console.log(`📧 Service account: ${credentials.client_email}`);
  } else {
    console.log('\n⚠️  WARNING: Google credentials not found!');
    console.log('Make sure GOOGLE_CREDENTIALS environment variable is set with base64 encoded JSON');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔴 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔴 Received SIGINT, shutting down gracefully');  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});