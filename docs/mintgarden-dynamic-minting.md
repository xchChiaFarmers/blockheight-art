# Bring your artwork on chain with MintGarden Dynamic Minting

[MintGarden Dynamic Minting](https://mintgarden.io/minting-api) lets you build your own Chia NFT minting experience around an API. Your application controls the design, metadata and checkout; MintGarden supplies the minting infrastructure and a Chia offer that the collector accepts in their wallet.

That is the approach used in **BlockHeight**: collectors design generative architectural art, choose a block height and mint their edition through MintGarden. This repository shares the deterministic artwork engine so you can build on that idea. A complete paid-offer journey using BlockHeight artwork has been exercised on Testnet11. That does not establish a completed Mainnet launch or verify every optional payment feature.

The renderer runs offline. The server, storage, checkout worker and MintGarden adapter described below belong to the BlockHeight application and are not included here. There is no mint command in this repository; `npm run render` only creates local artwork files.

## Why use it for generative art?

- **Keep your own creative interface.** Use `renderArtwork` to preview and finalize the collector's design, then attach your own collection metadata and traits.
- **Use a wallet-native purchase flow.** The collector takes a Chia offer in their wallet. Copying or downloading the offer works without connecting a wallet to the website; a WalletConnect handoff can be added separately.
- **Connect the NFT to the exact artwork.** The mint request supplies hashes and public URIs for the final artwork and metadata, together with the creator DID and royalties.
- **Create offers on demand.** BlockHeight reserves a block height when a collector checks out, then requests a time-limited offer instead of creating every edition in advance.

Start with [MintGarden's official guide](https://mintgarden.io/minting-api) for account setup, creator-profile authorization, API access and current Mint Credit terms.

## The flow used in BlockHeight

1. **Finalize the design on the server.** Validate the recipe, keep its seed and renderer version, render the final SVG and produce the NFT's display asset (BlockHeight also produces PNG). Client previews do not authorize final mint bytes.
2. **Publish immutable files.** Store the artwork and CHIP-0007 metadata at public HTTPS URLs, with persistent IPFS gateway mirrors and backups. Compute SHA-256 over the exact bytes served. The metadata can retain the recipe and link to the SVG master.
3. **Reserve the edition.** Persist the block height, price, payout and royalty terms and a unique submission id before contacting the provider. BlockHeight enforces one edition per block height in its database.
4. **Request a Dynamic Minting offer.** The backend calls `POST /mint/dynamic` with server-side Bearer authentication, asset references, price and royalties, plus `reserve_for_seconds` and a stable `deduplication_key`.
5. **Let the collector accept.** Validate and persist the returned offer, NFT id and expiry. Present its `offer1…` string for copy/download or a supported wallet handoff. The collector receives the NFT by taking the offer and paying in their wallet.
6. **Verify completion on the server.** Poll MintGarden's offer and NFT records. Complete the edition only after the NFT's trade record confirms the expected payment and its creator DID, royalty terms and artwork/metadata hashes match the stored intent.

In BlockHeight the corresponding lifecycle is `reserved` → `queued` → `submitting` → `awaiting_payment` → `minted`. An ambiguous submission or payment remains `unknown` for reconciliation rather than being reported as a successful mint.

## API endpoints and request fields

The BlockHeight adapter uses these API origins:

| Network | API origin |
| --- | --- |
| Testnet11 | `https://api.testnet.mintgarden.io` |
| Mainnet | `https://api.mintgarden.io` |

Profiles, addresses, credits and credentials must belong to the chosen network. Testnet success is not Mainnet acceptance. Send `Authorization: Bearer <server-side API key>` with the dynamic mint request; keep credentials out of browser code and Git.

For the **paid-offer** flow, BlockHeight maps these values:

| Request field | Meaning |
| --- | --- |
| `profile_id` | Authorized creator DID/profile |
| `metadata.data_uris`, `metadata.data_hash` | Public artwork URLs and SHA-256 of the exact asset bytes |
| `metadata.metadata_uris`, `metadata.metadata_hash` | Public CHIP-0007 JSON URLs and SHA-256 of the exact JSON bytes |
| `target_address` | Seller's payout address in this paid-offer flow; the buyer receives the NFT by taking the offer |
| `royalty_address`, `royalty_percentage` | Royalty recipient and percentage (`5` means 5%) |
| `requested_mojos` | Requested XCH price in integer mojos; 1 XCH = 1,000,000,000,000 mojos |
| `reserve_for_seconds` | Duration of the credit reservation and offer validity; BlockHeight defaults to 300 seconds |
| `deduplication_key` | Stable UUID for this submission, reused on bounded transient retries |

`reserve_for_seconds` and `deduplication_key` were confirmed with MintGarden and exercised against Testnet responses in BlockHeight; they were not in the public guide reviewed for that integration. Confirm their current support and behavior with MintGarden before production use. Inventing fields such as `expires_in` does not set an expiry: the observed API silently ignored unknown request fields.

The observed successful response contains `offer`, `offer_string` and `nft_id`. BlockHeight checks that the offer requests the expected asset and amount, offers exactly the expected NFT and expires within the requested window before showing it to a collector. This is an integration outline, not a complete request schema or a runnable client; use the current provider documentation and validate real responses.

## Mint Credits, expiry and retries

Mint Credits fund the provider service separately from the collector's purchase price. In BlockHeight's Testnet recordings a credit was consumed/reserved **when the offer was created**, before the buyer took it. With `reserve_for_seconds`, an unpaid offer expired and its credit became available again. Confirm current network-specific pricing and credit rules with MintGarden.

Without an explicit reservation, the observed offer had no expiry. Submitting an identical request without deduplication created another offer and consumed another credit. A duplicate `deduplication_key` was refused and did not create a second offer, but the refusal did not recover the first offer's contents.

BlockHeight therefore persists submission state, retries transient failures only a bounded number of times using the same key, and treats a lost or malformed response as uncertain. It holds the block-height reservation until the offer's expiry plus a confirmation margin (five minutes in BlockHeight). A normal checkout timeout alone cannot invalidate an offer already handed to a buyer. An offer still reported as open may already have expired; use its verified expiry as well as status.

## Prices and royalties

The observed MintGarden flow adds the royalty **on top of the requested price, including the first sale**. A request for 0.1 XCH with 5% royalties produced a 0.105 XCH offer. If your UI promises an all-inclusive price, reduce `requested_mojos` accordingly using integer arithmetic and account for rounding. BlockHeight chooses the largest request whose price plus the rounded-down royalty fits within the displayed total.

Use your payout address as `target_address` for a paid offer; putting the buyer's address there would direct the price to the wrong party. BlockHeight defaults the royalty address to the same payout wallet. Its recorded purchase used that shared address; separate-address payment behavior needs its own acceptance check.

The BlockHeight integration also has optional CAT/SBX payments and symbolic-price gift codes, but its documentation marks their provider behavior as requiring further live verification. They are not part of the verified XCH purchase example described here.

## Payment proof and permanent artwork

A wallet reporting success, an NFT page appearing, or an offer being created is not proof of a paid mint. BlockHeight queries `GET /offers/{id}` and `GET /nfts/{nft1…}` and verifies the NFT's recorded trade payment to the configured payout address, its asset and amount, creator DID, royalties and both file hashes. A taken offer with no indexed trade yet stays pending; unclear evidence stays unresolved.

Keep artwork and metadata bytes immutable once hashed. A hash preserves integrity, not availability: a temporary tunnel URL can disappear. Host permanent copies, pin content independently, retain the recipe and renderer version, and preserve the exact final SVG/PNG bytes. CHIP-0007 collection fields describe a collection; creator authentication comes from the minted NFT's DID provenance.

The MIT license in this repository covers its code, docs and example outputs. Choose and document the rights for your own NFT artwork separately. NFT license URIs and a license hash are separate on-chain fields; a rights statement in JSON alone does not populate them. BlockHeight treats their Dynamic Minting support as an optional feature needing its own acceptance check.

## Build your own integration

Start by [rendering an artwork](getting-started.md), then build a backend for immutable storage, edition reservations, provider submission and payment reconciliation. Exercise a complete paid purchase on Testnet with your own publicly reachable artwork before moving to Mainnet. Fund the correct profile's Mint Credits and confirm current API contracts with MintGarden.

This guide summarizes the BlockHeight implementation and recorded Testnet behavior reviewed on 2026-10-26. It shares the integration pattern without publishing BlockHeight's private application code, credentials or operational records.

- [MintGarden Dynamic Minting: official guide and onboarding](https://mintgarden.io/minting-api)
- [CHIP-0007 NFT metadata format](https://github.com/Chia-Network/chips/blob/main/CHIPs/chip-0007.md)
- [Engine entry point](../src/shared/render.ts) and [runnable rendering example](../scripts/render.mjs)
