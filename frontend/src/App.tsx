import { useEffect, useState } from "react";

interface Contact {
  contact: string;
  status: string;
  completedby: string;
  completedat: string;
  rowIndex: number;
}

const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/164SyT0TAXuWeMI1jfbj7ey0S80wUgLOPwB_E9wdBimk/edit?gid=0";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch contacts on load
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spreadsheetUrl: SPREADSHEET_URL }),
        });

        if (!res.ok) throw new Error("Backend error");

        const data = await res.json();
        setContacts(data.contacts || []);
      } catch (err: any) {
        setError("Backend connection failed: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  const markCompleted = async (rowIndex: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetUrl: SPREADSHEET_URL,
          rowIndex,
          completedBy: "Kumar",
        }),
      });

      if (!res.ok) throw new Error("Failed to complete");

      // Remove contact from list immediately
      setContacts((prev) => prev.filter((c) => c.rowIndex !== rowIndex));
    } catch (err: any) {
      alert("Error completing contact: " + err.message);
    }
  };

  if (loading) return <div className="p-4">Loading contacts...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-6 font-sans">
      <h1 className="text-xl font-bold mb-4">📞 Pending Contacts</h1>
      {contacts.length === 0 ? (
        <div>No available contacts</div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li
              key={c.rowIndex}
              className="p-3 border rounded flex justify-between items-center"
            >
              <span>{c.contact}</span>
              <button
                onClick={() => markCompleted(c.rowIndex)}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Mark Completed
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
