import React, { useState, useEffect } from 'react';
import { Phone, Users, CheckCircle, AlertCircle, Loader2, BarChart3, X } from 'lucide-react';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/164SyT0TAXuWeMI1jfbj7ey0S80wUgLOPwB_E9wdBimk/edit?gid=0#gid=0";

const ContactCallerApp = () => {
  const [contacts, setContacts] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [callerName, setCallerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({ total: 0, completed: 0, assigned: 0 });
  const [showInputPanel, setShowInputPanel] = useState(true);
  const [showProgress, setShowProgress] = useState(false);
  const [currentBatchNumber, setCurrentBatchNumber] = useState(1);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'https://contact-caller-backend.onrender.com';

  const testBackend = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (!response.ok) throw new Error(`Backend error: ${response.status}`);
      return true;
    } catch (error: any) {
      console.error('Backend connection failed:', error);
      setError(`Backend connection failed: ${error.message}`);
      return false;
    }
  };

  // Function to shuffle array randomly
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Function to get next batch of 12 contacts
  const getNextBatch = (allContactsList, completedCount) => {
    const startIndex = completedCount;
    return allContactsList.slice(startIndex, startIndex + 12);
  };

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
      
      if (data.contacts && data.contacts.length > 0) {
        // Shuffle all contacts randomly for this user
        const shuffledContacts = shuffleArray(data.contacts);
        setAllContacts(shuffledContacts);
        
        // Get first batch of 12
        const firstBatch = getNextBatch(shuffledContacts, 0);
        setContacts(firstBatch);
        setCurrentBatchNumber(1);
        
        setStats({ 
          total: shuffledContacts.length, 
          completed: 0, 
          assigned: firstBatch.length 
        });
        
        // Set session start time
        setSessionStartTime(new Date());
        
        setSuccess(`Loaded your random batch with ${firstBatch.length} contacts!`);
      } else {
        setError('No available contacts found in spreadsheet');
      }
    } catch (error: any) {
      console.error('Error loading contacts:', error);
      setError(`Failed to load contacts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const completeContact = async (contactToComplete: any) => {
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

      // Remove completed contact from current list
      const updatedContacts = contacts.filter(c => c.rowIndex !== contactToComplete.rowIndex);
      setContacts(updatedContacts);
      
      const newCompletedCount = stats.completed + 1;
      setStats(prev => ({ 
        ...prev, 
        completed: newCompletedCount,
        assigned: updatedContacts.length 
      }));

      setSuccess('Contact completed!');

      // If all 12 contacts are completed, automatically load next batch
      if (updatedContacts.length === 0) {
        loadNextBatch(newCompletedCount);
      }
    } catch (error: any) {
      console.error('Error completing contact:', error);
      setError(`Failed to mark contact as complete: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadNextBatch = (completedCount = stats.completed) => {
    if (completedCount >= allContacts.length) {
      setSuccess('All contacts completed! Great job!');
      setContacts([]);
      return;
    }

    const nextBatch = getNextBatch(allContacts, completedCount);
    
    if (nextBatch.length > 0) {
      setContacts(nextBatch);
      setCurrentBatchNumber(prev => prev + 1);
      setStats(prev => ({ 
        ...prev, 
        assigned: nextBatch.length 
      }));
      setSuccess(`Batch #${currentBatchNumber + 1} loaded with ${nextBatch.length} contacts!`);
    } else {
      setSuccess('All contacts completed! Great job!');
      setContacts([]);
    }
  };

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Calculate session duration
  const getSessionDuration = () => {
    if (!sessionStartTime) return '0m';
    const now = new Date();
    const diffInMinutes = Math.floor((now - sessionStartTime) / (1000 * 60));
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Calculate completion rate
  const getCompletionRate = () => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  };

  // Calculate contacts per hour
  const getContactsPerHour = () => {
    if (!sessionStartTime || stats.completed === 0) return 0;
    const now = new Date();
    const diffInHours = (now - sessionStartTime) / (1000 * 60 * 60);
    return Math.round(stats.completed / diffInHours);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-3 mb-4">
            <Phone className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">Contact Caller</h1>
            {showProgress && (
              <button
                onClick={() => setShowStatsModal(true)}
                className="ml-4 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg"
                title="View Statistics"
              >
                <BarChart3 className="h-6 w-6" />
              </button>
            )}
          </div>
          <p className="text-gray-600">Coordinate team calling efforts with real-time Google Sheets integration</p>
        </div>

        {/* Input Panel */}
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
                onClick={loadContacts}
                disabled={!callerName.trim()}
                className={`w-full p-3 mt-2 text-white rounded-lg ${
                  callerName.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Load Contacts
              </button>
            </div>
          </div>
        )}

        {/* Messages & Progress */}
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
                <h3 className="text-lg font-semibold mb-3">Batch #{currentBatchNumber} Progress for {callerName}</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">{contacts.length}</div>
                    <div className="text-sm text-gray-600">Current Batch</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
                    <div className="text-sm text-gray-600">Total Available</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-orange-600">{12 - contacts.length}</div>
                    <div className="text-sm text-gray-600">Done in Batch</div>
                  </div>
                </div>
                {contacts.length === 0 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => loadNextBatch()}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                    >
                      Load Next Batch
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Contacts Table */}
            {contacts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6" data-contacts-table>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Your Assigned Batch #{currentBatchNumber} ({contacts.length}/12 remaining)
                </h3>
                
                {/* Debug info - remove this after testing */}
                {process.env.NODE_ENV !== 'production' && (
                  <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                    <strong>Debug - First contact keys:</strong> {contacts[0] ? Object.keys(contacts[0]).join(', ') : 'No contacts'}
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-3 font-medium text-gray-700">Contact Number</th>
                        <th className="text-center p-3 font-medium text-gray-700">WhatsApp</th>
                        <th className="text-center p-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact, index) => {
                        // Extract phone number - try different possible property names including "Contact" with spaces
                        const phoneNumber = contact['Contact'] || 
                                          contact[' Contact '] || 
                                          contact['Contact '] || 
                                          contact[' Contact'] ||
                                          contact.contact || 
                                          contact.Contact ||
                                          contact.phone || 
                                          contact.Phone || 
                                          contact['Phone Number'] || 
                                          contact.number || 
                                          contact.Number || 
                                          contact[0] || 
                                          'N/A';
                        // Clean phone number for WhatsApp (remove spaces, dashes, etc.)
                        const cleanPhone = typeof phoneNumber === 'string' ? phoneNumber.replace(/[^\d+]/g, '') : phoneNumber;
                        
                        return (
                          <tr key={contact.rowIndex || index} className="border-b border-gray-100">
                            <td className="p-3 font-medium">{phoneNumber}</td>
                            <td className="p-3 text-center">
                              {phoneNumber !== 'N/A' && (
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm inline-flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                                  </svg>
                                  WhatsApp
                                </a>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => completeContact(contact)}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                              >
                                Complete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state when no contacts */}
            {showProgress && contacts.length === 0 && !loading && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6 text-center">
                <div className="py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Batch Completed!</h3>
                  <p className="text-gray-600 mb-4">You've completed all contacts in your current batch.</p>
                  <button
                    onClick={loadNextBatch}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                  >
                    Load Next Batch
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Stats Modal */}
        {showStatsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-indigo-600" />
                  Session Statistics
                </h2>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">Caller Information</h3>
                  <p className="text-blue-700"><strong>Name:</strong> {callerName}</p>
                  <p className="text-blue-700"><strong>Current Batch:</strong> #{currentBatchNumber}</p>
                  <p className="text-blue-700"><strong>Session Duration:</strong> {getSessionDuration()}</p>
                </div>

                {/* Progress Stats */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-3">Progress Overview</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                      <div className="text-green-700">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{stats.total - stats.completed}</div>
                      <div className="text-orange-700">Pending</div>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-800 mb-3">Performance Metrics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Total Contacts:</span>
                      <span className="font-medium text-purple-800">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Completion Rate:</span>
                      <span className="font-medium text-purple-800">{getCompletionRate()}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Contacts/Hour:</span>
                      <span className="font-medium text-purple-800">{getContactsPerHour()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Current Batch:</span>
                      <span className="font-medium text-purple-800">{contacts.length}/12 remaining</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Overall Progress</h3>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${getCompletionRate()}%` }}
                    ></div>
                  </div>
                  <div className="text-center text-sm text-gray-600 mt-1">
                    {stats.completed} of {stats.total} contacts completed
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowStatsModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowStatsModal(false);
                      // Scroll to contacts table
                      document.querySelector('[data-contacts-table]')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                  >
                    Continue Calling
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactCallerApp;
