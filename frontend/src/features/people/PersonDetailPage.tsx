import { Link, useNavigate, useParams } from "react-router-dom";
import { PersonForm } from "./PersonForm";
import { usePerson, useUpdatePerson } from "./usePeople";

const ACTIVE_STATUS_ID = "ref-person-status-active";

export function PersonDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const personQuery = usePerson(id);
  const mutation = useUpdatePerson(id);

  if (personQuery.isLoading) {
    return <main className="p-4">Loading person...</main>;
  }

  if (personQuery.error) {
    return (
      <main className="p-4 text-red-700">
        {(personQuery.error as Error).message}
      </main>
    );
  }

  if (!personQuery.data) {
    return <main className="p-4">Person not found.</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <Link className="mb-4 inline-block text-sm underline" to="/people">
        Back to People
      </Link>

      <h1 className="mb-4 text-2xl font-bold">
        {personQuery.data.firstName} {personQuery.data.lastName}
      </h1>

      {mutation.error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {(mutation.error as Error).message}
        </div>
      )}

      <PersonForm
        initial={personQuery.data}
        defaultStatusId={ACTIVE_STATUS_ID}
        submitting={mutation.isPending}
        onSubmit={async (input) => {
          await mutation.mutateAsync(input);
          navigate("/people");
        }}
      />
    </main>
  );
}