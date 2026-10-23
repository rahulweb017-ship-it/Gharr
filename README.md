# Gharr

India-first marketplace combining construction materials and local labour hiring.

> Build, repair and maintain your home — materials + labour in one app.

Built from `HomeBuild_App_Development_Blueprint.docx` and
`Construction_Super_App_Build_Plan.docx`, styled after the Gharr UI/UX boards
(navy + construction orange). This repository is **phase 1**: the responsive web
app and the REST API that the Android app will consume in phase 2.

## Status

| Milestone | Scope | State |
|---|---|---|
| 1 | Materials: onboarding → home → categories → product → cart → checkout → order tracking | Done |
| 2 | Labour: worker discovery → profile → hourly/daily booking → job lifecycle | Done |
| 4 | Estimate Engine: rules-based new-build and renovation estimates → itemised result → material list (BOQ) → "Buy Complete List" into the cart | Done |
| 5 | Responsive redesign to the UI/UX boards; address book; profile; city selection | Done |
| 6 | Admin console (`/admin`): supplier & worker verification with private documents, orders/bookings/refunds and dispute resolution, catalogue & estimate-pricing editor, users & roles, support tickets, dashboard, audit log | Done |
| next | Build plan §5.1 remainder: consultant review of estimates, project dashboard (budget vs spent, deliveries, documents), supplier self-service portal | Not started |

Deliberately absent for now: AI / photo- or drawing-based estimation, express
delivery, work-based labour sizing, WhatsApp features. The build plan puts all of
them in phase 2, on top of the rules engine rather than instead of it.

## Launch phasing

1. **Web app** (this repo)
2. **Android** — Expo React Native against the same `/api/v1`
3. **iOS** — same RN codebase, gated on traction

The API is the durable asset, not the web UI. All business logic lives in
`src/server/services/**` and `src/shared/**`, neither of which imports `next/*`
or `react`. When the Expo app arrives, those two folders lift into a shared
package and the web app becomes one client among two.

## Running it

Requires Node 20+ and PostgreSQL 17 running locally.

```bash
npm install
cp .env.example .env          # then set DATABASE_URL
npx prisma migrate deploy
npm run db:seed
npm run dev                   # http://localhost:3000 (use `npx next dev -p 3100` if 3000 is taken, with APP_BASE_URL to match)
```

### Demo accounts

OTP for demo numbers is always `000000`.

| Phone | Role |
|---|---|
| `9000000001` | Customer (Arjun Mehta — has a saved address and a saved estimate, "My Dream Home") |
| `9000000002` | Customer (Priya Sharma) |
| `9000000009` | Admin — full admin console at `/admin`, plus `/vendor-ops` |
| `9000000008` | Support — tickets, and read-only orders, bookings and users in `/admin` |
| `9701100002` | Worker (Suresh Kumar, electrician) — can reach `/worker` |
| any `90000000xx` | A brand-new customer — signs up on first code, starts with no address |

Worker and vendor accounts use realistic phone numbers, so their OTP is **not**
`000000`. It is printed to the server terminal in a box:

```
┌─────────────────────────────┐
│ GHARR — verification code │
│   Phone : +91 97011 00002   │
│   Code  : 219528            │
└─────────────────────────────┘
```

### Seeing it end to end

**Estimate → materials.** Signed out, open Estimate → New Home Construction →
1,200 sq ft plot, 1,800 sq ft built-up, 2 floors, Standard → the review step shows
a live total. Create it: you are asked to sign in (use a fresh `90000000xx`) and
land back on the wizard with the draft intact. The result shows Materials /
Labour / Other, an itemised quantity × rate table and the "indicative estimate"
disclaimer. View Detailed BOQ → untick a line, change a quantity → Buy Complete
List → the cart holds MOQ-valid pack counts at live prices → checkout → **Add new
address** → cash on delivery.

**Materials.** Sign in as `9000000001` → Shop → Cement → UltraTech OPC 53 →
pick a seller → add 10 bags → add something from a second seller → cart shows two
vendor groups with separate delivery fees → apply `BUILD10` → checkout with cash
on delivery → two orders are created, one per vendor. Sign in as `9000000009`,
open `/vendor-ops` and walk an order to Delivered; the customer timeline updates.

**Labour.** Sign in as `9000000001` → Labour → filter Electrician → open a
profile → Book → pick tomorrow, 3 hours → request. Sign in as the worker
(`9701100002`, OTP from the terminal) → `/worker` → Accept → Check in → Start →
Mark complete. Back as the customer, approve the work.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # estimate-engine maths (node:test via tsx)
npm run db:migrate   # create a migration
npm run db:seed
npm run db:studio    # browse the data
npm run db:reset     # drop, remigrate, reseed
```

## Architecture

```
src/
├─ app/
│  ├─ (auth)/          login, OTP verification
│  ├─ (app)/           customer surfaces + the two ops consoles
│  ├─ dev/pay/         offline test gateway (404s in production)
│  └─ api/v1/          the REST API — the contract the Android app will use
├─ server/             PORTABLE CORE — no next/react imports
│  ├─ auth/            OTP, JWT, rotating refresh tokens, session
│  ├─ http/            withRoute wrapper, error taxonomy, rate limiter
│  └─ services/        catalog, cart, pricing, checkout, order, worker,
│                      availability, booking, address, estimate, payment
├─ shared/             PORTABLE CONTRACTS — money, units, phone, trades, time,
│                      estimate (the pure engine), contracts/ (zod schemas)
├─ components/         ui/ shop/ labour/ layout/ forms/
└─ lib/                browser-only helpers
```

**Reads on the web** call the service layer directly from Server Components — no
HTTP hop. **Writes always go through `/api/v1`.** The same service function backs
both, so the web and the future mobile client cannot drift apart, and every
mutation the Android app needs is already an exercised endpoint.

Route handlers stay about ten lines because `withRoute` owns authentication,
role gating, CSRF, Zod validation, rate limiting, the response envelope and error
mapping.

## Decisions worth knowing

**Money is integer paise**, never floats, and every column is suffixed `Paise`.
Indian gateways already take paise, so there is no conversion at the boundary.
Formatting happens in exactly one place, `src/shared/money.ts`.

**Products are variant-backed and the vendor lives on the variant.** A `Product`
is shared catalogue identity; a `ProductVariant` is one vendor's offer with its
own price, pack, MOQ and stock. This is what produces multi-seller product pages,
per-vendor delivery fees and per-vendor cart grouping without special cases.

**One checkout produces one order per vendor**, sharing a `checkoutGroupId`, with
a single `Payment` across the group. Vendors ship independently, so fulfilment is
per-vendor; the customer pays once, so money is per-group. COD is only captured
when every vendor in the group has delivered.

**GST is applied after discount**, on tax-exclusive stored prices displayed
inclusive. Taxing the undiscounted amount overcharges GST — a compliance issue,
not a rounding preference. Coupon discounts are prorated with a largest-remainder
method so the parts sum exactly to the whole.

**Booking times are a date plus an integer minute-of-day**, never a `DateTime`.
This removes the entire class of "the booking moved by 5.5 hours" bug. Postgres
`date` columns are queried on UTC-midnight bounds and rendered from local
calendar days — the two are different functions on purpose.

**State machines are data, not conditionals.** `order-state.ts` and
`booking-state.ts` declare who may move what, where. One function per domain is
permitted to write status, it applies the change with a conditional update (so
two concurrent actors cannot both advance the same record), and it writes an
event for the customer timeline plus an audit log — all in one transaction.

**No Redis, no NextAuth, no Docker.** Rate limiting is a single atomic
`INSERT … ON CONFLICT … RETURNING` in Postgres. Auth is ~250 lines of `jose` plus
Prisma; NextAuth's cookie-centric session model actively obstructs a native
client. Search is `pg_trgm` with `word_similarity`, good to roughly 10k products.

**Estimates are auditable by construction.** `src/shared/estimate.ts` is a pure
function: quantity = basis (built-up / floor / wall sq ft, rooms, bathrooms,
floors) × norm × (1 + wastage), rounded **up**; amount = quantity × local unit
price. Percentage lines (sundries, design, contingency) apply to the itemised
subtotal only. Norms (`EstimateRule`) and prices (`EstimatePrice`, per city and
tier) are data seeded in `prisma/seed-estimates.ts`; material prices are derived
from the cheapest live offer of a linked product, so the estimate and the shop
never disagree. A saved estimate is an immutable line snapshot. The material
list converts each line to packs with `packCoverage` (a 16 sq ft tile box covers
16) and snaps to the offer's MOQ/step; the cart endpoint takes line ids and pack
counts only — never prices.

**`prisma migrate dev` will try to drop the trigram search indexes.** They are
created in raw SQL (`20260915182500_product_search_trgm`), which Prisma's schema
cannot express, so every generated migration includes
`DROP INDEX "brand_name_trgm"` / `"products_search_text_trgm"`. Create
migrations with `--create-only` and delete those lines before applying.

**Containers are units.** Paint buckets, cans and packs use the `BUCKET`, `CAN`
and `PACK` units with the contents in `packSize`, so prices read "₹7,850/bucket"
rather than a per-litre figure that was really per bucket.

**The admin console re-checks roles in the database on every call.** Access-token
role claims can be 15 minutes stale, so `requireStaff` (`src/server/services/admin/guard.ts`)
reads `roles` and `isActive` fresh — a suspended or demoted admin loses access
immediately for admin actions. ADMIN is full access; SUPPORT works tickets and reads
orders, bookings and users. Every admin write is audit-logged in the same transaction
(`src/server/audit.ts`). Vendors can only read and move their own orders.

**Refunds are recorded before the gateway is called.** A prepaid order that is
cancelled is refunded automatically after the cancellation commits; if the provider
fails, the Refund row stays `REFUND_PENDING` and shows in the admin queue for retry.
Refunds are capped per order as well as per payment, since one payment covers every
vendor in a checkout.

**Private documents** (ID proofs, GST certificates) live under `PRIVATE_STORAGE_DIR`
(`storage/private`, gitignored) and are only served by a staff-only route with
`no-store` caching and a sandboxing CSP.

**Tailwind v4 CSS-variable syntax is `rounded-(--radius-card)`.** The v3-style
`rounded-[--radius-card]` compiles to invalid CSS in v4 and silently drops the
radius/shadow; the codebase was migrated.

## Designed-for, not built

- **Fixed-price jobs.** Pricing is always `(rateType, amount, quantity)`; the
  `FIXED` branch is implemented and the nullable `quoteId` already exists. Adding
  quote negotiation is a UI change plus one new table, not a pricing rewrite.
- **Real payment gateway.** `PaymentProvider` has three implementations: `cod`,
  `mock` and `razorpay`. Razorpay's signature verification — the genuinely
  security-critical part — is written now; intent creation throws until keys
  exist. Going live is `PAYMENT_PROVIDER=razorpay` plus three env vars.
- **Real SMS.** `SmsProvider` has a console implementation; MSG91 is a skeleton
  awaiting DLT template registration.
- **Object storage.** `storage/private/**` behind signed URLs in development;
  swapping to S3/R2 is one file.

## Known gaps

- Product imagery is placeholder. "Large product photography" is central to the
  design direction, so real photos need sourcing or licensing.
- Delivery distance is not yet wired to a maps provider, so `perKmFeePaise` is
  modelled but the per-km component is zero until one is configured.
- Estimate rules and prices are edited in `prisma/seed-estimates.ts` or Prisma
  Studio; the admin price editor arrives with the admin panel. Only Hyderabad has
  a price table.
- Estimates have no consultant verification yet (build plan §3.5).
- Worker document verification has no review UI — seeded workers are
  pre-verified.
- Automated tests cover the estimate maths only (`npm test`). Other flows are
  verified end to end manually against the API and the database.
