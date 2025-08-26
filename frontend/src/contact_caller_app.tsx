import { useState } from "react";
import ContactsScreen from "./ContactsScreen"; // keep your original component

export default function ContactCallerApp() {
  const [nameInput, setNameInput] = useState("");
  const [enteredName, setEnteredName] = useState<string | null>(null);

  const handleLoadContacts = () => {
    if (!nameInput.trim()) return;
    setEnteredName(nameInput.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {/* Input + Load Contacts button (always visible initially) */}
      {!enteredName && (
        <>
          <input
            type="text"
            placeholder="Enter your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="p-2 border rounded w-64 mb-2"
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

      {/* Show your original contacts screen after clicking Load Contacts */}
      {enteredName && <ContactsScreen userName={enteredName} />}
    </div>
  );
}
