import React, { useState, useEffect } from 'react';
import { Phone, Users, CheckCircle, AlertCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';

// Define the constant SHEET_URL
const SHEET_URL = "https://docs.google.com/spreadsheets/d/164SyT0TAXuWeMI1jfbj7ey0S80wUgLOPwB_E9wdBimk/edit?gid=0#gid=0";

const ContactCallerApp = () => {
  const [contacts, setContacts] = useState([]);
  const [currentContact, setCurrentContact] = useState(null);
  const [callerName, setCallerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({ total: 0, completed: 0 });

  // Prefer env var for flexibility
  const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'https://contact-caller-backend.onrender.com';

  // Test backend connection
  const testBackend = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (!response.ok) throw new Error(`Backend error: ${response.status}`);
      const data = await response.json();
      console.log('Backend status:', data);
      return true;
    } catch (error) {
      console.error('Backend connection failed:', error);
      setError(`Backend connection failed: ${error.message}`);
      return false;
    }
  };

  // Load contacts from spreadsheet
  const loadContacts = async () => {
    setLoading(true);
    setError('');
    try {
      // Test backend first
      const backendOk = await testBackend();
      if (!backendOk) return;

      const response = await fetch(`${BACKEND_URL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetUrl: SHEET_URL }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setContacts(data.contacts || []);
      setStats({ total: data.contacts?.length || 0, completed: 0 });
      
      if (data.contacts && data.contacts.length > 0) {
        setCurrentContact(data.contacts[0]);
        setSuccess(`Loaded ${data.contacts.length} contacts successfully!`);
      } else {
        setError('No available contacts found in spreadsheet');
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      setError(`Failed to load contacts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Mark contact as completed
  const completeContact = async () => {
    if (!currentContact || !callerName.trim()) {
      setError('Please enter your name first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetUrl: SHEET_URL,
          rowIndex: currentContact.rowIndex,
          completedBy: callerName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Remove current contact from list
      const updatedContacts = contacts.filter(c => c.rowIndex !== currentContact.rowIndex);
      setContacts(updatedContacts);
      setStats(prev => ({ ...prev, completed: prev.completed + 1 }));

      // Move to next contact
      if (updatedContacts.length > 0) {
        setCurrentContact(updatedContacts[0]);
        setSuccess(`Contact completed! Moving to next contact.`);
      } else {
        setCurrentContact(null);
        setSuccess('🎉 All contacts completed! Great job!');
      }
    } catch (error) {
      console.error('Error completing contact:', error);
      setError(`Failed to mark contact as complete: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Test spreadsheet connection
  const testConnection = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetUrl: SHEET_URL }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setSuccess(`✅ ${data.message}`);
    } catch (error) {
      setError(`Connection test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-3 mb-4">
            <Phone className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">Contact Caller</h1>
          </div>
          <p className="text-gray-600">Coordinate team calling efforts with real-time Google Sheets integration</p>
        </div>

        {/* Setup Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Setup
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Sheet
              </label>
              <div className="flex gap-2">
                <a
                  href={SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-2 text-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Google Sheet
                </a>
                <button
                  onClick={testConnection}
                  disabled={loading}
                  className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Test
                </button>
              </div>
            </div>

            <button
              onClick={loadContacts}
              disabled={loading}
              className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Load Contacts
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Stats */}
        {contacts.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Progress</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{contacts.length}</div>
                <div className="text-sm text-gray-600">Remaining</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Contact */}
        {currentContact && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Current Contact
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(currentContact).map(([key, value]) => {
                  if (key === 'rowIndex') return null;
                  return (
                    <div className="border-b border-gray-200 pb-2" key={key}>
                      <div className="text-sm font-medium text-gray-600 capitalize">{key}</div>
                      <div className="text-lg text-gray-800">{value || 'N/A'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={completeContact}
                disabled={loading || !callerName.trim()}
                className="flex-1 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Mark as Completed
              </button>
            </div>
          </div>
        )}

        {/* No contacts state */}
        {contacts.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Contacts Available</h3>
            <p className="text-gray-500">All contacts have been completed or no data found in the spreadsheet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactCallerApp;
