import test from "node:test";
import assert from "node:assert/strict";
import { eventObjects } from "../src/shared/event-layout.js";

test("optional spend layouts fill the host pane and keep every object inside its bounds", () => {
  for (const mode of ["elongated", "tiled", "stacked"] as const)
    for (const cell of [
      { x: 10, y: 20, z: 30, w: 200, h: 30, d: 50 },
      { x: -200, y: -100, z: -50, w: 40, h: 180, d: 22 },
    ])
      for (const count of [0, 1, 3, 7, 43, 100_000]) {
        const objects = eventObjects(mode, count, cell, 1, 4);
        assert.equal(
          objects.length,
          Math.min(
            count,
            mode === "elongated" ? 4 : mode === "tiled" ? 48 : 96,
          ),
        );
        for (const o of objects) {
          assert.ok(o.x - o.width / 2 > cell.x);
          assert.ok(o.x + o.width / 2 < cell.x + cell.w);
          assert.ok(o.y - o.height / 2 > cell.y);
          assert.ok(o.y + o.height / 2 < cell.y + cell.h);
          assert.ok(o.back >= cell.z + 3 - 1e-6);
          assert.ok(o.front <= cell.z + cell.d - 3 + 1e-6);
          assert.ok(o.back < o.front);
          if (mode === "tiled") {
            assert.ok(Math.abs(o.back - (cell.z + 3)) < 1e-6);
            assert.ok(Math.abs(o.front - (cell.z + cell.d - 3)) < 1e-6);
          }
        }
        assert.equal(objects.length === 0, count === 0);
        if (count === 1) {
          assert.ok(objects[0]!.width > cell.w * 0.65);
          assert.ok(objects[0]!.height > cell.h * 0.65);
        }
        if (mode === "stacked" && count >= 5)
          assert.equal(new Set(objects.map((o) => o.front)).size, 3);
      }
});
