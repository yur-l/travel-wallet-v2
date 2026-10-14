# Travel Wallet Formal V8

V8 builds on V7 session recovery and V5 Realtime.

## Before deploying V8

Run this file once in the **existing Supabase project**:

`supabase/v8-migration.sql`

Then push the V8 project to the Vercel-connected repository.

## V8 changes

- Wallet name field stays blank when creating a wallet.
- Join-request count is highlighted on the wallet card.
- All active wallet members can see/copy the invite code.
- All active wallet members can approve/reject join requests, edit wallet details, edit/delete transactions, and remove non-owner members.
- Only the wallet owner can delete/restore the wallet.
- Wallet deletion is now a 14-day soft delete with a grey card, countdown, and Restore button.
- Expired soft-deleted wallets are purged by `purge_expired_wallets()` when the app next starts a session.
- Create Wallet form resets after a successful creation.
- Top-up records can be edited in both currencies.
- Expense categories: Food / Transport / Shopping / no category (default notebook icon).
- Expense category can also be edited later.
- Clicking an expense category icon filters expenses; Clear filter appears in red.
- Latest Records shows the latest 3 transactions across dates instead of only the newest day.
- Added Chinese translations for Initial Balance, Top Up, empty expense states, edit Note, and language-aware dates.

## Important

Do not run the full `supabase/schema.sql` on the existing production project. It is for rebuilding a fresh project. Use only `supabase/v8-migration.sql` for the current live database.


## V8.1 UI polish
- Category buttons use compact 13px labels.
- Expense Records shows expenses only (Top Ups removed from that screen).
- Transaction dates use DD-MM-YYYY.
- Latest Records shows up to 5 records.
- Expense Records includes a tap-icon-to-filter hint.
