# Travel Wallet Formal V3

Current focus: guest-first wallet ownership and sharing-ready data model.

## What works now
- Guest profile is saved on this device with `localStorage`.
- Wallets, top ups, expenses, members, and join requests persist after refresh on the same browser/device.
- Every wallet has an `ownerId` and member records with user IDs.
- Owner-only controls: edit wallet, delete wallet, approve/reject join requests, remove members.
- Joined members can use wallets they have access to, but cannot use owner-only controls.
- Wallet list labels wallets as Owned / Joined.
- Wallet name field starts completely blank (no placeholder).

## Important sharing limitation
The current app is still a client-only Vite app. Invite codes can only resolve wallets available in the browser's local data. True cross-device joining needs a shared backend/database. The V3 data model is structured so a backend such as Supabase can be connected next without changing the wallet ownership/member model.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
