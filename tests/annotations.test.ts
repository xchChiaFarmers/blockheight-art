import test from "node:test";
import assert from "node:assert/strict";
import {
  countLabel,
  xchLabel,
  lineText,
  placeMarkers,
  type Marker,
} from "../src/shared/annotations.js";

test("annotation numbers retain exact mojo precision without locale or floating point", () => {
  assert.equal(countLabel(1_000_000), "1,000,000");
  for (const [input, expected] of [
    ["0", "0 XCH"],
    ["1", "0.000000000001 XCH"],
    ["1000000099", "0.001000000099 XCH"],
    ["1000000000000", "1 XCH"],
    ["99999999999999999999", "99999999.999999999999 XCH"],
    ["00000000000000000001", "0.000000000001 XCH"],
    ["00000000000000000000", "0 XCH"],
  ])
    assert.equal(xchLabel(input!), expected);
});

test("crowded callouts stay separated, bounded and in visual order on both rails", () => {
  for (const anchorY of [-100, 120, 750, 2000]) {
    const markers: Marker[] = Array.from({ length: 12 }, (_, i) => ({
      entry: {
        id: String(i + 1),
        key: "nft",
        label: "NFT",
        value: "1 SPEND",
        count: 1,
      },
      anchor: [i < 6 ? 300 : 700, anchorY],
    }));
    const placed = placeMarkers(markers.reverse(), 30, 780);
    for (const x of [78, 922]) {
      const lane = placed.filter((m) => m.x === x);
      assert.equal(lane.length, 6);
      lane.forEach((m, i) => {
        assert.ok(m.y >= 30 && m.y <= 780);
        if (i) {
          assert.ok(m.y - lane[i - 1]!.y >= 34);
          assert.ok(Number(m.entry.id) > Number(lane[i - 1]!.entry.id));
        }
      });
    }
  }
});

test("embedded lettering escapes accessible labels and needs no fonts or resources", () => {
  const svg = lineText("<script>\"&' test", 50, 60, 10, "#123456");
  assert.match(svg, /aria-label="&lt;script&gt;&quot;&amp;&apos; test"/);
  assert.match(svg, /<path transform=/);
  assert.doesNotMatch(svg, /<script|<text|font|href=|url\(/);
});
