import { Link } from "react-router-dom";
import { usePeople } from "./usePeople";

export function PeopleListPage() {
  const { data, isLoading, error } = usePeople();
  const people = Array.isArray(data) ? data : [];

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="text-sm text-gray-600">Permanent person records</p>
        </div>

        <Link className="rounded bg-black px-4 py-2 text-white" to="/people/new">
          Add
        </Link>
      </div>

      {isLoading && <p>Loading people...</p>}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && people.length === 0 && (
        <div className="rounded border bg-white p-6 text-center">
          <p className="font-medium">No people yet.</p>
          <Link className="mt-3 inline-block underline" to="/people/new">
            Create the first person
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {people.map((person) => (
          <Link
            key={person.id}
            to={`/people/${person.id}`}
            className="block rounded border bg-white p-4 shadow-sm"
          >
            <div className="font-semibold">
              {person.firstName} {person.lastName}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {person.cellular || "No cellular"} · {person.email || "No email"}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Status: {person.statusLabel || person.statusId}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}