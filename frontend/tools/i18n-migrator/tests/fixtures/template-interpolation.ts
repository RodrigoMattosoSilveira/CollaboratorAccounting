export function buildMessage(created: { priceDate: string }) {
  return `Gold price for ${created.priceDate} recorded.`;
}
