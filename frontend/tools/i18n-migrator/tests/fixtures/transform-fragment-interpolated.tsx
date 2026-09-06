export function TransformFragmentInterpolatedFixture({
  gramsPerBrl,
  goldPrice,
}: {
  gramsPerBrl: number;
  goldPrice: { brlPerGram: number };
}) {
  return (
    <>
      <dd>
        BRL ÷ {formatDecimal(goldPrice.brlPerGram)} = grams
      </dd>
      <p>
        Example: R$ 1.00 converts to {formatDecimal(gramsPerBrl, 6)} g using this source.
      </p>
    </>
  );
}

function formatDecimal(value: number, precision = 2) {
  return value.toFixed(precision);
}
