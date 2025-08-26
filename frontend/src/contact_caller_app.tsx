import { useState } from "react";

export default function ContactCallerApp() {
  const [nameInput, setNameInput] = useState("");
  const [enteredName, setEnteredName] = useState<string | null>(null);
  const [showContacts, setShowContacts] = useState(false);

  const handleLoadContacts = () => {
    if (!nameInput.trim()) return; // don’t allow empty
    setEnteredName(nameInput.trim());
    setShowContacts(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {/* Step 1: Input + Button visible initially */}
      {!showContacts && (
        <>
          <input
            type="text"
            placeholder="Enter your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="p-2 border rounded w-64 mb-4"
          />
          <button
            className={`px-4 py-2 rounded text-white ${
              nameInput.trim()
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={handleLoadContacts}
            disabled={!nameInput.trim()}
          >
            Load Contacts
          </button>
        </>
      )}

      {/* Step 2: Contacts screen after button click */}
      {showContacts && (
        <div className="mt-8 w-full max-w-lg">
          {/* Replace below with your actual contacts/progress component */}
          <p className="text-lg font-semibold">
            Contacts for <span className="text-blue-600">{enteredName}</span>
          </p>
          {/* Example: <ContactsScreen name={enteredName} /> */}
        </div>
      )}
    </div>
  );
}
