export function TransformConditionalFixture({ isPending }: { isPending: boolean }) {
  return <button disabled={isPending}>{isPending ? "Recording..." : "Record Gold Price"}</button>;
}
