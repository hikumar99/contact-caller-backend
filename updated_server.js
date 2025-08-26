const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration - CRITICAL for Netlify + Render
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'https://comforting-twilight-9f6115.netlify.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
  },
  credentials: true
}));

app.use(express.json());

// Health check endpoint - CRITICAL for testing
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins
  });
});

// Google Sheets setup
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Get contacts from spreadsheet
app.post('/api/contacts', async (req, res) => {
  try {
    const { spreadsheetUrl } = req.body;
    
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'Spreadsheet URL is required' });
    }

    // Extract spreadsheet ID from URL
    const match = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid spreadsheet URL' });
    }
    
    const spreadsheetId = match[1];
    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // First sheet
    const rows = await sheet.getRows();
    
    // Filter for incomplete contacts
    const contacts = rows
      .map((row, index) => ({
        rowIndex: index + 2, // Google Sheets is 1-indexed, +1 for header
        ...row.toObject()
      }))
      .filter(contact => {
        const status = contact.Status || contact.status || '';
        const completedBy = contact.Completedby || contact.completedby || contact.CompletedBy || '';
        return status.toLowerCase() !== 'completed' && !completedBy.trim();
      });

    res.json({ contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark contact as completed
app.post('/api/complete', async (req, res) => {
  try {
    const { spreadsheetUrl, rowIndex, completedBy } = req.body;
    
    if (!spreadsheetUrl || !rowIndex || !completedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const match = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid spreadsheet URL' });
    }
    
    const spreadsheetId = match[1];
    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    const targetRow = rows[rowIndex - 2]; // Adjust for 0-indexing and header
    if (!targetRow) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    // Update the row
    targetRow.Status = 'Completed';
    targetRow.Completedby = completedBy;
    targetRow.Completedat = new Date().toLocaleString();
    
    await targetRow.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Allowed origins:', allowedOrigins);
});
