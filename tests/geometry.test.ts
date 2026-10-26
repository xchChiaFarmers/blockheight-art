import test from "node:test";
import assert from "node:assert/strict";
import {
  bevelMesh,
  closestOnMesh,
  cutCorner,
  connectorMesh,
  type Vec3,
} from "../src/shared/geometry.js";

test("bevel mesh is closed, planar and stays inside its source box", () => {
  const box = { x: -4, y: 2, z: -3, w: 10, h: 12, d: 8 };
  const faces = bevelMesh(box, 1);
  assert.equal(faces.length, 26);
  const edges = new Map<string, number>();
  for (const face of faces) {
    const plane = face.points[0]!.reduce(
      (sum, v, i) => sum + v * face.normal[i]!,
      0,
    );
    for (const [i, p] of face.points.entries()) {
      assert.ok(
        p[0] >= -4 &&
          p[0] <= 6 &&
          p[1] >= 2 &&
          p[1] <= 14 &&
          p[2] >= -3 &&
          p[2] <= 5,
      );
      assert.ok(
        Math.abs(
          p.reduce((sum, v, k) => sum + v * face.normal[k]!, 0) - plane,
        ) < 1e-8,
      );
      const q = face.points[(i + 1) % face.points.length]!;
      const edge = [p.join(","), q.join(",")].sort().join("/");
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok(
    [...edges.values()].every((count) => count === 2),
    "every mesh edge joins exactly two faces",
  );
});

test("connection sockets follow the cable direction and start at the docking plane", () => {
  const a: Vec3 = [3, 4, 5];
  for (const b of [
    [33, 4, 5],
    [3, 4, 35],
    [3, 34, 5],
    [23, 24, 25],
  ] as Vec3[]) {
    const ray = b.map((v, i) => v - a[i]!);
    const length = Math.hypot(...ray);
    const distances = connectorMesh(a, b, "collars")
      .flatMap((face) => face.points)
      .map(
        (p) => p.reduce((sum, v, i) => sum + (v - a[i]!) * ray[i]!, 0) / length,
      );
    assert.ok(Math.abs(Math.min(...distances)) < 1e-8);
    assert.ok(Math.abs(Math.max(...distances) - 5) < 1e-8);
  }
});

test("wire docking lands on bevel faces, edges and corners", () => {
  const mesh = bevelMesh({ x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 }, 1);
  for (const [target, expected] of [
    [
      [5, 5, 15],
      [5, 5, 10],
    ],
    [
      [-2, -2, 5],
      [0.5, 0.5, 5],
    ],
    [
      [-2, -2, -2],
      [2 / 3, 2 / 3, 2 / 3],
    ],
  ] as [Vec3, Vec3][]) {
    const dock = closestOnMesh(mesh, target);
    assert.ok(dock.every((v, i) => Math.abs(v - expected[i]!) < 1e-8));
  }
});

test("corner section removes exactly the front upper octant without overlapping parts", () => {
  const box = { x: -5, y: 0, z: -5, w: 10, h: 10, d: 10 };
  const parts = cutCorner(box, 5);
  assert.equal(
    parts.reduce((sum, p) => sum + p.w * p.h * p.d, 0),
    875,
  );
  for (let x = -4.5; x < 5; x++)
    for (let y = 0.5; y < 10; y++)
      for (let z = -4.5; z < 5; z++) {
        const retained = parts.filter(
          (p) =>
            x > p.x &&
            x < p.x + p.w &&
            y > p.y &&
            y < p.y + p.h &&
            z > p.z &&
            z < p.z + p.d,
        ).length;
        assert.equal(retained, x >= 0 && y >= 5 && z >= 0 ? 0 : 1);
      }
  assert.deepEqual(
    cutCorner({ ...box, x: 1, y: 6, z: 1, w: 1, h: 1, d: 1 }, 5),
    [],
  );
  assert.deepEqual(cutCorner({ ...box, x: -20 }, 5), [{ ...box, x: -20 }]);
});
