function SummaryCard(props: { label: string; value: number }) {
  return <div>{props.label}:{props.value}</div>;
}
function UnknownCard(props: { title: string; description: string }) {
  return <div>{props.title}{props.description}</div>;
}
function PriceListItemForm(props: { title: string; description: string; submitLabel: string; pendingLabel: string; layout: string }) {
  return <div>{props.title}{props.description}{props.submitLabel}{props.pendingLabel}{props.layout}</div>;
}
export function CustomComponentsFixture() {
  return (
    <div>
      <SummaryCard label="Total outstanding" value={5} />
      <PriceListItemForm title="Create Price List Item" description="Create an item" submitLabel="Save Changes" pendingLabel="Saving..." layout="wide" />
      <UnknownCard title="Should stay manual" description="Unknown custom text" />
    </div>
  );
}
