export function FragmentsFixture({ page, totalPages, total }: { page: number; totalPages: number; total: number }) {
  return <p>Showing page {page} of {totalPages} · {total} receipts</p>;
}
