# Graduation Party — Seat Reservation System

## Project Overview
- **Name**: grad-party-seating
- **Goal**: Let guests browse a visual seat map and reserve seats for a graduation party in real time, while admins manage seat blocking and approve/cancel reservations from a protected dashboard.
- **Stack**: React 18 + TypeScript (Vite) on the frontend, Tailwind CSS (CDN) for styling, **Firebase Firestore** (data) + **Firebase Authentication** (admin login) as the sole backend. No custom server — the browser talks to Firebase directly via the SDK.

> **Status of this task**: Both the **Guest View** (Welcome → Seat Map → Booking Form) and the **Admin Dashboard** (map view, block/unblock, approve pending / cancel confirmed reservations) are complete and wired to real-time Firestore. The seat map now mirrors the venue's **exact physical layout** — a Balcony section and a Main Floor section, each with a visible center aisle between the left and right seat blocks (see "Theater Seating Layout" below). See "Not Yet Implemented" for what's left (mainly: auto-expiring stale Pending seats, and Cloud Functions/server-side scheduling, which Cloudflare Pages can't run natively).

## Guest View Flow (`/`)
1. **Welcome Page** (`src/pages/WelcomePage.tsx`) — shows event title/date/time/venue/description and a **Book Now** button.
2. **Seat Map** (`src/pages/BookingPage.tsx` + `src/components/SeatGrid.tsx` + shared `src/components/TheaterSeatMap.tsx`) — a live, color-coded rendering of every seat in `seats`, laid out to match the venue's real physical structure (Balcony above, Main Floor below, each row split into Left/Right blocks around a visible aisle — see "Theater Seating Layout"):
   - 🟩 **Green** = `Available` (clickable)
   - ⬜ **Gray** = `Pending` (locked, not clickable)
   - ⬛ **Black** = `Confirmed` (not clickable)
   - 🟥 **Red** = `Blocked` / VIP (not clickable)
   - A selected seat gets a blue ring. Selection is capped at `MAX_SEATS_PER_BOOKING` (4, configurable in `src/config/eventConfig.ts`) — once 4 are selected, other green seats become temporarily disabled until the guest deselects one.
   - **Guests can never cancel a reservation** — there is no Cancel/delete affordance anywhere in the guest-facing flow. Cancelling is an **Admin Dashboard-only** action (see below).
3. **Booking Form** (`src/components/BookingForm.tsx`) — appears below the grid, shows the selected seat numbers, and collects: Full Name, Phone Number, Payment Method (`Cash` / `InstaPay` dropdown), Servant Name (dropdown, from `SERVANT_NAMES`). Displays the required disclaimer: *"Payment must be completed within 1 hour to confirm reservation."*
4. On submit, `reservationService.createReservation()` is called — see **Race-Condition Prevention** below. On success, the guest sees a confirmation screen with their seat numbers and can book again or return to the Welcome Page.

A discreet **Admin Login** link sits in the guest page footer, linking to `/admin`.

## Admin Dashboard (`/admin`)
Protected by a **Firebase Authentication (email/password) login** — `src/pages/AdminLoginPage.tsx` — gated by `src/AdminApp.tsx`, which only renders `AdminDashboardPage` once `onAuthStateChanged` confirms a signed-in user. There is no public sign-up: create admin accounts yourself in the **Firebase Console → Authentication → Users → Add user**.

`AdminDashboardPage` (`src/pages/AdminDashboardPage.tsx`) has two live sections, both subscribed via Firestore `onSnapshot` so changes made by guests, other admins, or in other browser tabs reflect **instantly, everywhere**, with no manual refresh:

1. **Visual Map View** (`AdminSeatGrid.tsx` / `AdminSeat.tsx`, both built on the shared `TheaterSeatMap.tsx`) — the entire theater map (Balcony + Main Floor, with aisle) with the same real-time color coding as the guest view.
   - **Block/Unblock Mode**: a toggle switch above the map. When ON, clicking any **green** (`Available`) seat sets it to **red** (`Blocked`, VIP-only), and clicking any **red** seat reverts it to **green** (`Available`). `Pending`/`Confirmed` seats are not affected by this toggle — they're managed via the reservations tables below. Each block/unblock call (`seatService.blockSeat` / `unblockSeat`) runs in its own Firestore transaction that re-checks the seat is still in the expected state before writing, so it can't race against a guest's booking transaction.
2. **Pending Reservations** (`ReservationsTable.tsx`) — every reservation whose seats are currently `Pending` (a reservation's status is *derived* from its seats' live status — see `src/utils/reservationStatus.ts` — since the `reservations` collection has no `status` field of its own). Each row shows guest name, phone, seat numbers/labels, payment method, servant name, and when it was requested, plus two actions:
   - **Approve** → `reservationService.confirmReservation()` — atomically flips every seat in that reservation to `Confirmed` (black).
   - **Cancel** → `reservationService.cancelReservation()` — atomically releases every seat back to `Available` (green) **and deletes the reservation document**.
3. **Confirmed Reservations** (same `ReservationsTable.tsx`, `onApprove` omitted) — every reservation whose seats are `Confirmed`, kept visible so the admin always knows who booked which seat. The **only** action here is **Cancel** — clicking it runs the same `cancelReservation()` transaction, releasing the seats back to `Available` and deleting the booking. **This is the sole place in the entire app where a confirmed reservation can be cancelled** — it does not exist anywhere in the guest-facing UI, and `firestore.rules` requires an authenticated admin session (`request.auth != null`) to delete a `reservations` document, so a guest cannot trigger it even by calling Firestore directly.

## Race-Condition Prevention (Important)
Two guests could theoretically click the same green seat at almost the same instant, or an admin could try to block a seat a guest is mid-booking. To prevent this, every state-changing seat operation is wrapped in a **Firestore `runTransaction`**:
- `createReservation()` (guest booking): re-reads the live status of every selected seat inside the transaction; if **any** seat is no longer `'Available'`, the whole transaction throws and **nothing is written** — no partial bookings.
- `blockSeat()` / `unblockSeat()` (admin toggle): re-reads the seat and only proceeds if it's still in the expected starting status (`Available` for block, `Blocked` for unblock).
- `confirmReservation()` / `cancelReservation()` (admin approve/cancel): read the reservation's seat list and update every seat together, atomically.

Firestore transactions use optimistic concurrency: if two clients' transactions race on the same document, Firestore automatically retries the loser against the fresh data, so the check-then-write logic above is never bypassed — whichever operation commits first wins, and the other is rejected with a clear error instead of corrupting state.

## Theater Seating Layout
The seat map's physical structure is defined **once**, in `src/config/theaterLayout.json`, and consumed by both the seed script and the React app (via the typed wrapper `src/config/theaterLayout.ts`) so they can never drift out of sync. To change the venue's layout (including section order), edit only that JSON file, then re-run the seed script with `--reseed` (see below).

Rendered top-to-bottom, matching the physical room: **Stage/Screen** at the very top, then **Main Floor** directly in front of it, then **Balcony** behind the Main Floor (farthest from the stage).

**Main Floor** (288 seats, rows numbered front-to-back):
| Row(s) | Left seats | Aisle | Right seats |
|---|---|---|---|
| R1 – R12 (12 rows) | 12 | ✓ | 12 |

**Balcony** (144 seats, R1 = closest to the Main Floor, counting back to R9 = last row):
| Row(s) | Left seats | Aisle | Right seats |
|---|---|---|---|
| R1 – R2 (2 rows) | 10 | ✓ | 10 |
| R3 – R8 (6 rows) | 8 | ✓ | 8 |
| R9 (1 row) | 4 | ✓ | 4 |

**Grand total: 432 seats.** Each seat's `seat_number` is generated as `` `${section}-R${row}-${side}-${seat_index}` ``, e.g. `Balcony-R1-Left-1`, `Main-R5-Right-12` — so admins and guests always know exactly where a seat physically is. The seat *button* itself displays only the short `seat_index` (e.g. `12`) since the full label wouldn't fit in a small grid cell; hover/tap the seat (or check the reservations table) to see its full label.

Rendering: `src/components/TheaterSeatMap.tsx` is a shared component (used by both the guest `SeatGrid` and the admin `AdminSeatGrid` via a `renderSeat` render-prop) that walks this layout (in `THEATER_LAYOUT` array order — Main Floor first, then Balcony) and renders each section with a title, each row with a row label, a Left seat block, a visible dashed-line **aisle gap**, and a Right seat block — so the guest and admin views are always structurally identical, and only the individual seat cell's clickability/tooltip differs.

## Data Architecture

### Firestore Collections

**`seats`**
| Field | Type | Notes |
|---|---|---|
| `id` | string (doc ID) | auto-generated by Firestore |
| `seat_number` | string | full physical label, e.g. `"Balcony-R1-Left-1"`, `"Main-R5-Right-12"` |
| `status` | `'Available' \| 'Pending' \| 'Confirmed' \| 'Blocked'` | drives the grid color everywhere |
| `reservation_id` | string \| null | back-reference to the owning reservation, kept in sync by the service layer |
| `section` | `'Balcony' \| 'Main'` | which theater section |
| `row` | number | 1-based row number *within its section* |
| `side` | `'Left' \| 'Right'` | which side of the center aisle |
| `seat_index` | number | 1-based position within its row+side block, counted outward from the aisle (index 1 = nearest the aisle) — this is what's displayed on the seat button itself |

**`reservations`**
| Field | Type | Notes |
|---|---|---|
| `id` | string (doc ID) | auto-generated by Firestore |
| `guest_name` | string | from the booking form |
| `phone_number` | string | from the booking form |
| `payment_method` | `'Cash' \| 'InstaPay'` | dropdown in the booking form |
| `servant_name` | string | dropdown in the booking form |
| `seat_ids` | string[] | seat document IDs included in this reservation (max 4) |
| `created_at` | Firestore server timestamp | set automatically on creation |

Type definitions live in `src/types/models.ts`. Note there is no `status` field on `Reservation` — see `src/utils/reservationStatus.ts` for how it's derived from seat statuses.

## Project Structure
```
webapp/
├── src/
│   ├── firebase/config.ts          # Firebase app + Firestore + Auth init (reads VITE_FIREBASE_* env vars)
│   ├── types/models.ts             # Seat / Reservation TypeScript interfaces + collection name constants
│   ├── config/eventConfig.ts       # Event details, servant name list, MAX_SEATS_PER_BOOKING
│   ├── config/theaterLayout.json   # SINGLE SOURCE OF TRUTH for the venue's physical seating chart (Balcony/Main Floor, rows, left/right counts)
│   ├── config/theaterLayout.ts     # Typed wrapper: THEATER_LAYOUT, buildSeatNumber(), generateSeatDefinitions(), getTotalSeatCount()
│   ├── utils/
│   │   ├── seatLayout.ts           # Groups a flat seat list into Section -> Row -> {leftSeats, rightSeats} per THEATER_LAYOUT, for aisle-gap rendering
│   │   ├── seatColors.ts           # Shared status -> Tailwind color mapping (guest + admin grids)
│   │   └── reservationStatus.ts    # Derives Pending/Confirmed/Unknown from a reservation's seats
│   ├── services/
│   │   ├── seatService.ts          # CRUD + realtime subscription + blockSeat/unblockSeat transactions
│   │   ├── reservationService.ts   # CRUD + transactional booking/confirm/cancel for `reservations`
│   │   └── authService.ts          # Firebase Auth: adminSignIn/adminSignOut/subscribeToAuthState
│   ├── components/
│   │   ├── TheaterSeatMap.tsx      # SHARED physical layout (Balcony/Main Floor, rows, aisle gap) — used by both SeatGrid and AdminSeatGrid via a renderSeat render-prop
│   │   ├── Seat.tsx                # guest-facing clickable seat cell (color-coding & click logic unchanged by the layout redesign)
│   │   ├── SeatGrid.tsx            # guest-facing grid, wraps TheaterSeatMap, enforces 4-seat cap
│   │   ├── AdminSeat.tsx           # admin seat cell, supports Block/Unblock toggle mode
│   │   ├── AdminSeatGrid.tsx       # admin map, wraps TheaterSeatMap, renders every seat with live status
│   │   ├── SeatLegend.tsx          # color legend (Available/Pending/Confirmed/Blocked/Selected)
│   │   ├── BookingForm.tsx         # guest details form + payment disclaimer
│   │   └── ReservationsTable.tsx   # reservations table w/ Approve (pending only) & Cancel actions — Cancel is only ever wired up from the Admin Dashboard
│   ├── pages/
│   │   ├── WelcomePage.tsx         # event details + Book Now button
│   │   ├── BookingPage.tsx         # guest seat grid + booking form + submit/transaction wiring
│   │   ├── AdminLoginPage.tsx      # email/password login form
│   │   └── AdminDashboardPage.tsx  # admin map view + block toggle + reservations table
│   ├── App.tsx                     # Guest View: Welcome <-> Booking switcher (no router needed)
│   ├── AdminApp.tsx                # Admin auth gate: renders AdminLoginPage or AdminDashboardPage
│   ├── main.tsx                    # React root; simple path check routes "/admin" -> AdminApp, else -> App
│   └── vite-env.d.ts               # typed import.meta.env for Firebase vars
├── scripts/seedSeats.mjs           # bulk-creates the 432 seat documents from theaterLayout.json; supports --reseed
├── firestore.rules                 # security rules: open reads, guest-scoped seat-lock/reservation-create, admin-only everything else
├── firestore.indexes.json          # composite indexes for status/seat_number and servant_name/created_at
├── firebase.json                   # Firebase CLI config (rules + indexes deploy target)
├── public/_redirects               # Cloudflare Pages SPA fallback so /admin doesn't 404 on refresh
├── .env.example                    # template for required Firebase env vars
└── wrangler.jsonc                  # Cloudflare Pages static-hosting config (no bindings needed)
```

## Setup Guide

### 1. Create a Firebase project
1. Go to the [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. Enable **Firestore Database** (start in test mode, or production mode + use `firestore.rules` here).
3. Enable **Authentication → Sign-in method → Email/Password**.
4. In **Project Settings → General → Your apps**, register a **Web app** and copy the config values.

### 2. Create an admin account
In **Authentication → Users → Add user**, create one (or more) admin accounts with an email + password. These are the only credentials that can sign in at `/admin` — there is no self-service sign-up.

### 3. Configure environment variables
```bash
cp .env.example .env.local
# then fill in VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc.
```
`.env.local` is git-ignored — never commit real Firebase keys (note: Firebase web API keys are not secret in the traditional sense, but Firestore access is still governed by `firestore.rules`, which you should review before going live).

### 4. Install & run locally
```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173 (or use dev:sandbox for port 3000)
```
Guest view: `http://localhost:5173/` — Admin dashboard: `http://localhost:5173/admin`

### 5. Seed initial seats
Edit `src/config/theaterLayout.json` to match your venue's real seating chart (sections, rows, left/right seat counts per row) — this is the **single source of truth** read by both the app and the seed script. Then run:
```bash
node scripts/seedSeats.mjs            # seeds only if 'seats' is currently empty
node scripts/seedSeats.mjs --reseed   # ⚠️ DESTRUCTIVE: deletes ALL existing reservations + seats first, then reseeds from theaterLayout.json
```
Use `--reseed` whenever you change `theaterLayout.json` after having already seeded once (e.g. adding/removing rows or seats) — since it changes the Seat schema/shape, old documents won't match the new layout otherwise. Requires `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (an existing admin account) in `.env.local`, since `firestore.rules` requires an authenticated admin session to write `seats`/`reservations`.

### 6. Customize event details & servants
Edit `src/config/eventConfig.ts`:
- `EVENT_CONFIG` — title, date, time, venue, description shown on the Welcome Page.
- `SERVANT_NAMES` — options in the Servant Name dropdown.
- `MAX_SEATS_PER_BOOKING` — max seats a guest may select (default 4).

### 7. Deploy Firestore rules/indexes (optional, requires Firebase CLI)
```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

## Deployment (Frontend)
This is a static SPA — build output can be hosted anywhere static (Cloudflare Pages, Firebase Hosting, Netlify, etc.):
```bash
npm run build       # outputs to dist/
npm run deploy       # deploys dist/ to Cloudflare Pages (project: grad-party-seating)
```
Remember to set the same `VITE_FIREBASE_*` variables in your hosting provider's build environment. `public/_redirects` is copied into `dist/` automatically by Vite and makes the SPA fallback (`/admin` on refresh, etc.) work on Cloudflare Pages.

## User Guide

### Guests
1. Open the site — you'll see the **Welcome Page** with the event details.
2. Tap **Book Now**.
3. Tap any **green** seat to select it (up to 4). Tap again to deselect. Gray/black/red seats cannot be selected.
4. Scroll down to the **Booking Form**, fill in your name, phone number, choose a payment method and the servant who is assisting you, then tap **Reserve**.
5. If successful, your seats are now `Pending` — **complete payment within 1 hour** or the seats may be released by an admin.
6. If someone else grabbed one of your seats a moment before you submitted, you'll see an error asking you to pick different seats (nothing is double-booked).

### Admins
1. Go to `/admin` and sign in with your admin email/password.
2. The **Theater Map** shows every seat's live status. Flip **Block/Unblock Mode** on to click green seats to block them (VIP) or click red seats to release them.
3. Scroll to **Pending Reservations** to see every reservation awaiting payment. For each: verify payment was received, then click **Approve** to confirm those seats (turns black), or click **Cancel** to release the seats back to green and delete the reservation (e.g. if payment never arrived).
4. Scroll to **Confirmed Reservations** to see every already-approved booking (kept here for traceability — always know who reserved which seat). Click **Cancel** on any row to release its seat(s) back to green and delete the booking (e.g. the guest cancelled in person, or it was booked in error). **This admin-only Cancel is the only way to cancel a confirmed reservation anywhere in the system** — guests cannot cancel their own booking from the guest-facing pages.
5. Click **Sign Out** when done.

## Not Yet Implemented
- **Automatic expiry**: nothing currently auto-releases a `Pending` seat after 1 hour if payment isn't confirmed — an admin must manually **Cancel** it. Implementing this needs either a scheduled job (e.g. a Cloud Function on a timer) or a lazy check-on-read pattern, since Cloudflare Pages has no cron/background jobs.
- Search/filter for reservations by servant, guest name, or payment method.
- Deeper input validation (e.g. duplicate guest detection).
- Multi-admin roles/permissions (currently any signed-in Firebase Auth user has full admin access — there's no separate "servant" vs "super-admin" tier).
- Audit log of who approved/cancelled/blocked what and when.

## Recommended Next Steps
1. Implement the 1-hour pending-expiry rule (Cloud Function on a schedule, or a lazy "check and release stale pending seats" pass triggered on page/dashboard load).
2. Add search/filter and pagination to the reservations table for larger events.
3. Add toast/notification feedback and loading skeletons for a more polished experience on both the guest and admin sides.
4. Consider Firestore custom claims or a separate `admins` collection if you need tiered admin permissions later.
