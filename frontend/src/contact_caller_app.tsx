{/* Contacts Table */}
            {contacts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contacts to Call ({Math.min(12, contacts.length)} shown)
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">WhatsApp</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 12).map((contact, index) => (
                        <tr key={contact.rowIndex} className={`border-b border-gray-100 hover:bg-gray-50 ${contact.completed ? 'opacity-50' : ''}`}>
                          <td className="py-4 px-4">
                            <span className="text-lg font-medium text-gray-800">{contact.contact || contact.Contact || 'N/A'}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {(contact.contact || contact.Contact) && (
                              <a
                                href={`https://wa.me/${contact.contact || contact.Contact}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                              >
                                <Phone className="h-4 w-4" />
                                WhatsApp
                              </a>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => completeSpecificContact(contact)}
                              disabled={loading || !callerName.trim() || contact.completed}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                contact.completed 
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {loading && currentContact?.rowIndex === contact.rowIndex ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : contact.completed ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              {contact.completed ? 'Completed' : 'Mark as Completed'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
