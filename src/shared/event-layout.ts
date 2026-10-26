/** Optional arrangements of symbolic event forms inside an existing host pane. */
export type EventLayout = "elongated" | "tiled" | "stacked";
export type EventObject = {
  x: number;
  y: number;
  front: number;
  back: number;
  width: number;
  height: number;
};

export function eventObjects(
  mode: EventLayout,
  count: number,
  cell: { x: number; y: number; z: number; w: number; h: number; d: number },
  scale: number,
  classicCap: number,
): EventObject[] {
  const n = Math.min(
    count,
    mode === "elongated" ? classicCap : mode === "tiled" ? 48 : 96,
  );
  if (n < 1) return [];
  const pad = Math.min(cell.w, cell.h) * 0.1;
  const width = cell.w - 2 * pad;
  const height = cell.h - 2 * pad;
  const depth = cell.d - 6;
  const layers = mode === "stacked" ? Math.min(3, Math.ceil(n / 2)) : 1;
  const objects: EventObject[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const amount = Math.floor(n / layers) + (layer < n % layers ? 1 : 0);
    const rows =
      mode === "elongated"
        ? width >= height
          ? amount
          : 1
        : Math.max(
            1,
            Math.min(amount, Math.round(Math.sqrt((amount * height) / width))),
          );
    const stepY = height / rows;
    for (let row = 0; row < rows; row++) {
      const columns = Math.floor(amount / rows) + (row < amount % rows ? 1 : 0);
      const stepX = width / columns;
      for (let column = 0; column < columns; column++) {
        const front = cell.z + 3 + (depth * (layer + 1)) / layers;
        objects.push({
          x: cell.x + pad + stepX * (column + 0.5),
          y: cell.y + pad + stepY * (row + 0.5),
          front,
          back: front - (depth / layers) * (mode === "tiled" ? 1 : 0.78),
          width: stepX * 0.82 * scale,
          height: stepY * 0.82 * scale,
        });
      }
    }
  }
  return objects;
}
