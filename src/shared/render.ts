/** Version dispatch. Every issued version stays byte-identical; new work is issued as blockheight-4. */
import {
  renderSvg,
  validateParams,
  type ArtParams,
  type Artwork,
} from "./art.js";
import {
  renderSvg2,
  renderSvg3,
  renderSvg4,
  validateParams2,
  type Art2Params,
  type Artwork2,
  type Artwork3,
  type Artwork4,
} from "./art2.js";

export type AnyArtwork = Artwork | Artwork2 | Artwork3 | Artwork4;
export type AnyParams = ArtParams | Art2Params;

export function renderArtwork(art: AnyArtwork): string {
  if (art.rendererVersion === "blockheight-1") return renderSvg(art);
  if (art.rendererVersion === "blockheight-2") return renderSvg2(art);
  if (art.rendererVersion === "blockheight-3") return renderSvg3(art);
  if (art.rendererVersion === "blockheight-4") return renderSvg4(art);
  throw new Error("Unknown renderer version");
}

/** Accepts the current blockheight-2 parameter set, or the three-field blockheight-1 set for older clients. */
export function parseParams(
  value: unknown,
):
  | { version: "blockheight-2"; params: Art2Params }
  | { version: "blockheight-1"; params: ArtParams } {
  try {
    return { version: "blockheight-2", params: validateParams2(value) };
  } catch {
    return { version: "blockheight-1", params: validateParams(value) };
  }
}
