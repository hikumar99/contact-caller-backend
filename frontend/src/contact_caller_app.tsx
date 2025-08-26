import React, { useState, useEffect } from 'react';
import { Phone, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Define the constant SHEET_URL
const SHEET_URL = "https://docs.google.com/spreadsheets/d/164SyT0TAXuWeMI1jfbj7ey0S80wUgLOPwB_E9wdBimk/edit?gid=0#gid=0";

const ContactCallerApp = () => {
  const [contacts, setContacts] = useState([]);
  const [callerName, setCallerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({ total: 0, completed: 0 });
  const [showInputPanel, setShowInputPanel] = useState(true);
  const [showProgress, setShowProgress] = useState(false);

  const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'https://contact-caller-backend.onrender.com';

  // Test backend connection
  const testBackend = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (!response.ok) throw new Error(`Backend error: ${response.status}`);
      return true;
    } catch (error) {
      console.error('Backend connection failed:', error);
      setError(`Backend connection failed: ${error.message}`);
      return false;
    }
  };

  // Load contacts from spreadsheet
  const loadContacts = async () => {
    if (!callerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setShowInputPanel(false);
    setShowProgress(true);
    setLoading(true);
    setError('');

    try {
      const backendOk = await testBackend();
      if (!backendOk) return;

      const response = await fetch(`${BACKEND_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  const completeContact = async (contactToComplete) => {
    if (!contactToComplete || !callerName.trim()) {
      setError('Please enter your name first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetUrl: SHEET_URL,
          rowIndex: contactToComplete.rowIndex,
          completedBy: callerName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const updatedContacts = contacts.filter(c => c.rowIndex !== contactToComplete.rowIndex);
      setContacts(updatedContacts);
      setStats(prev => ({ ...prev, completed: prev.completed + 1 }));

      setSuccess('Contact completed!');
    } catch (error) {
      console.error('Error completing contact:', error);
      setError(`Failed to mark contact as complete: ${error.message}`);
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

        {/* Name Input + Load Contacts Button */}
        {showInputPanel && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Get Started
            </h2>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your name to begin calling contacts
              </label>
              <input
                type="text"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
             <button
  onClick={() => completeContact(contact)}
  disabled={loading || !callerName.trim()}
  className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
>
  Complete
</button>

            </div>
          </div>
        )}

        {/* Progress & Messages */}
        {showProgress && (
          <>
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

            {loading && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <p className="text-lg text-gray-700">Loading contacts...</p>
                </div>
              </div>
            )}

            {/* Stats */}
            {contacts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 className="text-lg font-semibold mb-3">Progress for {callerName}</h3>
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

           {/* Current Contacts Table (up to 12) */}
{contacts.length > 0 && (
  <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
      <Phone className="h-5 w-5" />
      Current Contacts
    </h3>

    <div className="grid gap-3">
      {contacts.slice(0, 12).map((contact) => (
        <div
          key={contact.rowIndex}
          className="grid grid-cols-3 items-center gap-4 p-3 border-b border-gray-200 rounded-md"
        >
          <div className="text-gray-800 font-medium">{contact.Contact}</div>
          <a
            href={`https://wa.me/${contact.Contact}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 font-semibold hover:underline"
          >
            WhatsApp
          </a>
          <button
            onClick={() => completeContact(contact)}
            disabled={loading || !callerName.trim()}
            className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
          >
            Complete
          </button>
        </div>
      ))}
    </div>
  </div>
)}

{/* Closing all parent containers */}
</div> {/* closes max-w-4xl container */}
</div> {/* closes min-h-screen container */}
);
};

export default ContactCallerApp;
