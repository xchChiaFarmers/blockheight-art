/**
 * A block height for people to read: 5128567 becomes "5,128,567". Fixed `en-US` grouping (no
 * locale lookup), so the browser, the server and the artwork captions always agree. Data fields
 * (traits, API, metadata `block_height`) stay plain numbers.
 */
export function formatHeight(height: number | string): string {
  return String(height).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
