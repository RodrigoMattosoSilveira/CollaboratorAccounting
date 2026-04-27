import { ApiError } from "../api/client";

export function ApiErrorPanel({ error }: { error: unknown }) {
  if (!error) return null;

  const message = error instanceof Error ? error.message : "Unexpected error";

  return (
    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-semibold">{message}</p>

      {error instanceof ApiError && (
        <>
          <p className="mt-1 text-xs text-red-700">
            Status: {error.status}
            {error.code ? ` · Code: ${error.code}` : ""}
          </p>

          {error.fields && Object.keys(error.fields).length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {Object.entries(error.fields).map(([field, fieldMessage]) => (
                <li key={field}>
                  <span className="font-medium">{field}:</span> {fieldMessage}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}