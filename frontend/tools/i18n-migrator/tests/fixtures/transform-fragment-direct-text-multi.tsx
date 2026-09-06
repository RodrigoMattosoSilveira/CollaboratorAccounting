export function TransformFragmentDirectTextMultiFixture({
  actorName,
  count,
}: {
  actorName: string;
  count: number;
}) {
  return (
    <>
      <label>
        Recorded By
        <input value={actorName} readOnly />
        <span>{actorName}</span>
      </label>
      <p>
        Showing <strong>{count}</strong> items <em>{actorName}</em>
      </p>
    </>
  );
}
