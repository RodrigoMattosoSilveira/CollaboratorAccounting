export function TransformFragmentSimpleFixture() {
  return (
    <label>
      Price Date
      <input type="date" />
    </label>
  );
}

export function TransformFragmentMultiExprFixture({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  return (
    <p>
      Showing page {page} of {totalPages} · {total} receipts
    </p>
  );
}
