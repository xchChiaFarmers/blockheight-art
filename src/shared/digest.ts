/** What the renderer knows about a real Chia block. Pure data; no network, no node imports. */
export const legacyEventCategories = [
  "xch",
  "cat",
  "nft",
  "did",
  "offer",
  "datalayer",
  "pool",
  "service",
  "unknown",
] as const;
export const eventCategories = [
  ...legacyEventCategories,
  "channel",
  "dao",
  "credential",
  "contract",
] as const;
export type EventCategory = (typeof eventCategories)[number];
type LegacyCategory = (typeof legacyEventCategories)[number];
export const currentDigestVersion = 2;

export type ChainDigest = {
  version: 1 | 2;
  height: number;
  headerHash: string;
  transactionBlock: boolean;
  timestamp: number | null;
  /** Total block fees in mojos. */
  fees: string;
  /** Reward coins paid out in this block (earned by earlier heights). */
  rewards: { farmer: number; pool: number };
  /** Coin spends in the block. */
  spends: number;
  /** Fixed-order keys for the version; new categories are absent from archival v1 digests. */
  events: Record<LegacyCategory, number> &
    Partial<Record<Exclude<EventCategory, LegacyCategory>, number>>;
  /** Distinct CAT tokens moved. */
  tokens: number;
};

const count = (value: unknown, max = 1_000_000): number => {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > max
  )
    throw new Error("Invalid chain digest");
  return value as number;
};

/** Strict parse: only known keys, only plain numbers/strings. Returns a fresh, fixed-order object. */
export function validateDigest(value: unknown): ChainDigest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid chain digest");
  const v = value as Record<string, unknown>;
  const keys =
    "version,height,headerHash,transactionBlock,timestamp,fees,rewards,spends,events,tokens";
  if (Object.keys(v).sort().join(",") !== keys.split(",").sort().join(","))
    throw new Error("Invalid chain digest");
  if (v.version !== 1 && v.version !== currentDigestVersion)
    throw new Error("Invalid chain digest");
  const categories = v.version === 1 ? legacyEventCategories : eventCategories;
  if (typeof v.headerHash !== "string" || !/^[0-9a-f]{64}$/.test(v.headerHash))
    throw new Error("Invalid chain digest");
  if (typeof v.transactionBlock !== "boolean")
    throw new Error("Invalid chain digest");
  if (typeof v.fees !== "string" || !/^[0-9]{1,20}$/.test(v.fees))
    throw new Error("Invalid chain digest");
  const rewards = v.rewards as Record<string, unknown> | null;
  const events = v.events as Record<string, unknown> | null;
  if (
    !rewards ||
    typeof rewards !== "object" ||
    !events ||
    typeof events !== "object"
  )
    throw new Error("Invalid chain digest");
  if (Object.keys(rewards).sort().join(",") !== "farmer,pool")
    throw new Error("Invalid chain digest");
  if (Object.keys(events).sort().join(",") !== [...categories].sort().join(","))
    throw new Error("Invalid chain digest");
  return {
    version: v.version,
    height: count(v.height, Number.MAX_SAFE_INTEGER),
    headerHash: v.headerHash,
    transactionBlock: v.transactionBlock,
    timestamp: v.timestamp === null ? null : count(v.timestamp, 4_102_444_800),
    fees: v.fees,
    rewards: {
      farmer: count(rewards.farmer, 100_000),
      pool: count(rewards.pool, 100_000),
    },
    spends: count(v.spends),
    events: Object.fromEntries(
      categories.map((c) => [c, count(events[c])]),
    ) as ChainDigest["events"],
    tokens: count(v.tokens),
  };
}
