/** Small deterministic meshes shared by the renderer and its docking calculation. */
export type Vec3 = readonly [number, number, number];
export type Box = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
};
export type Face = {
  points: Vec3[];
  normal: Vec3;
  /** Main faces have an axis; edge and corner bevels do not. */
  axis?: number;
  side?: number;
};

/** Six inset rectangles, twelve edge bevels and eight corner triangles. */
export function bevelMesh(box: Box, amount: number): Face[] {
  const lo = [box.x, box.y, box.z];
  const hi = [box.x + box.w, box.y + box.h, box.z + box.d];
  const b = Math.min(amount, box.w / 4, box.h / 4, box.d / 4);
  const faces: Face[] = [];
  const vertex = (sides: number[], outer: number[]): Vec3 =>
    sides.map((side, axis) =>
      side < 0
        ? lo[axis]! + (outer.includes(axis) ? 0 : b)
        : hi[axis]! - (outer.includes(axis) ? 0 : b),
    ) as unknown as Vec3;
  for (let axis = 0; axis < 3; axis++) {
    const a = (axis + 1) % 3;
    const c = (axis + 2) % 3;
    for (const side of [-1, 1]) {
      const points = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sa, sc]) => {
        const sides = [0, 0, 0];
        sides[axis] = side;
        sides[a] = sa!;
        sides[c] = sc!;
        return vertex(sides, [axis]);
      });
      const normal = [0, 0, 0];
      normal[axis] = side;
      faces.push({ points, normal: normal as unknown as Vec3, axis, side });
    }
  }
  for (let a = 0; a < 3; a++)
    for (let c = a + 1; c < 3; c++) {
      const along = 3 - a - c;
      for (const sa of [-1, 1])
        for (const sc of [-1, 1]) {
          const sides = [0, 0, 0];
          sides[a] = sa;
          sides[c] = sc;
          sides[along] = -1;
          const p = vertex(sides, [a]);
          const q = vertex(sides, [c]);
          sides[along] = 1;
          const r = vertex(sides, [c]);
          const s = vertex(sides, [a]);
          const normal = [0, 0, 0];
          normal[a] = sa;
          normal[c] = sc;
          faces.push({
            points: [p, q, r, s],
            normal: normal as unknown as Vec3,
          });
        }
    }
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const sides = [sx, sy, sz];
        faces.push({
          points: [vertex(sides, [0]), vertex(sides, [1]), vertex(sides, [2])],
          normal: sides as unknown as Vec3,
        });
      }
  return faces;
}

/** Nearest point on the actual mesh, including chamfers at edges and corners. */
export function closestOnMesh(faces: Face[], target: Vec3): Vec3 {
  let best: Vec3 = faces[0]!.points[0]!;
  let distance = Infinity;
  const consider = (p: Vec3): void => {
    const d = p.reduce((sum, v, i) => sum + (v - target[i]!) ** 2, 0);
    if (d < distance) {
      distance = d;
      best = p;
    }
  };
  for (const { points, normal } of faces) {
    const norm = normal.reduce((sum, n) => sum + n * n, 0);
    const offset =
      normal.reduce((sum, n, i) => sum + n * (target[i]! - points[0]![i]!), 0) /
      norm;
    const projected = target.map(
      (n, i) => n - offset * normal[i]!,
    ) as unknown as Vec3;
    const signs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const edge = b.map((n, k) => n - a[k]!);
      const v = projected.map((n, k) => n - a[k]!);
      signs.push(
        (edge[1]! * v[2]! - edge[2]! * v[1]!) * normal[0] +
          (edge[2]! * v[0]! - edge[0]! * v[2]!) * normal[1] +
          (edge[0]! * v[1]! - edge[1]! * v[0]!) * normal[2],
      );
      const length = edge.reduce((sum, n) => sum + n * n, 0);
      const t =
        length === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                edge.reduce((sum, n, k) => sum + n * (target[k]! - a[k]!), 0) /
                  length,
              ),
            );
      consider(a.map((n, k) => n + t * edge[k]!) as unknown as Vec3);
    }
    if (signs.every((n) => n >= -1e-6) || signs.every((n) => n <= 1e-6))
      consider(projected);
  }
  return best;
}

export type CutBox<T> = T & {
  cutFaces?: { x?: boolean; y?: boolean; z?: boolean };
};
/** Remove the upper, positive-X, front octant without overlapping the retained pieces. */
export function cutCorner<T extends Box>(box: T, level: number): CutBox<T>[] {
  const ix = Math.max(box.x, 0);
  const iy = Math.max(box.y, level);
  const iz = Math.max(box.z, 0);
  const xmax = box.x + box.w,
    ymax = box.y + box.h,
    zmax = box.z + box.d;
  if (ix >= xmax || iy >= ymax || iz >= zmax) return [box];
  const parts: CutBox<T>[] = [];
  if (box.x < ix) parts.push({ ...box, w: ix - box.x, cutFaces: { x: true } });
  if (box.y < iy)
    parts.push({
      ...box,
      x: ix,
      w: xmax - ix,
      h: iy - box.y,
      cutFaces: { y: true },
    });
  if (box.z < iz)
    parts.push({
      ...box,
      x: ix,
      y: iy,
      w: xmax - ix,
      h: ymax - iy,
      d: iz - box.z,
      cutFaces: { z: true },
    });
  return parts;
}

/** A short socket aligned to its cable, starting exactly at the docking point. */
export function connectorMesh(
  endpoint: Vec3,
  other: Vec3,
  kind: "collars" | "nodes",
): Face[] {
  const vector = other.map((v, i) => v - endpoint[i]!);
  const length = Math.hypot(...vector);
  if (length < 1e-6) return [];
  const direction = vector.map((v) => v / length);
  const thickness = Math.min(kind === "nodes" ? 9 : 5, length / 3);
  const radius = kind === "nodes" ? 4.5 : 5.5;
  const reference = Math.abs(direction[2]!) < 0.8 ? [0, 0, 1] : [0, 1, 0];
  const u = [
    direction[1]! * reference[2]! - direction[2]! * reference[1]!,
    direction[2]! * reference[0]! - direction[0]! * reference[2]!,
    direction[0]! * reference[1]! - direction[1]! * reference[0]!,
  ];
  const norm = Math.hypot(...u);
  const unit = u.map((v) => v / norm);
  const v = [
    direction[1]! * unit[2]! - direction[2]! * unit[1]!,
    direction[2]! * unit[0]! - direction[0]! * unit[2]!,
    direction[0]! * unit[1]! - direction[1]! * unit[0]!,
  ];
  const mesh = bevelMesh(
    {
      x: -radius,
      y: -radius,
      z: 0,
      w: 2 * radius,
      h: 2 * radius,
      d: thickness,
    },
    kind === "nodes" ? 2 : 0.7,
  );
  return mesh.map((face) => ({
    points: face.points.map(
      (p) =>
        endpoint.map(
          (n, i) => n + unit[i]! * p[0] + v[i]! * p[1] + direction[i]! * p[2],
        ) as unknown as Vec3,
    ),
    normal: face.normal.map(
      (_, i) =>
        unit[i]! * face.normal[0] +
        v[i]! * face.normal[1] +
        direction[i]! * face.normal[2],
    ) as unknown as Vec3,
  }));
}
