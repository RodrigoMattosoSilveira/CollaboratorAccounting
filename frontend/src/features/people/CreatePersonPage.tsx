import { Link, useNavigate } from "react-router-dom";
import { PersonForm } from "./PersonForm";
import { useCreatePerson } from "./usePeople";

const ACTIVE_STATUS_ID = "ref-person-status-active";

export function CreatePersonPage() {
  const navigate = useNavigate();
  const mutation = useCreatePerson();

  return (
    <main className="mx-auto max-w-3xl p-4">
      <Link className="mb-4 inline-block text-sm underline" to="/people">
        Back to People
      </Link>

      <h1 className="mb-4 text-2xl font-bold">New Person</h1>

      {mutation.error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {(mutation.error as Error).message}
        </div>
      )}

      <PersonForm
        defaultStatusId={ACTIVE_STATUS_ID}
        submitting={mutation.isPending}
        onSubmit={async (input) => {
          const created = await mutation.mutateAsync(input);
          navigate(`/people/${created.id}`);
        }}
      />
    </main>
  );
}