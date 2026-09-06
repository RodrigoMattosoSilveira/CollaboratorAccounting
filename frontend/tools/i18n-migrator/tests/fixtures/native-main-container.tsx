export function ReceiptDetail({ found }: { found: boolean }) {
  if (!found) {
    return <main>Receipt not found.</main>;
  }
  return <main>Loading receipt...</main>;
}
