# Travel Wallet - Supabase Connected

This build uses Supabase for anonymous authentication, wallets, membership, join requests, and transactions.

## Required environment variables

Create `.env.local` for local development:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Do not put a Supabase secret/service-role key in this project.

## Vercel

In Vercel -> Project -> Settings -> Environment Variables, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Add them for Production, Preview, and Development, then redeploy.

## Run locally

```bash
npm install
npm run dev
```

## Current shared-wallet flow

1. First launch -> user enters a display name -> Supabase anonymous user is created.
2. Create Wallet -> wallet + initial top-up are stored in Supabase.
3. A second device enters the invite code -> pending join request is created.
4. Owner opens the wallet/member area -> approves or rejects the request.
5. After approval, the second user can access the same wallet and transactions.

The Supabase session is persisted by `supabase-js`. Anonymous users still lose access if they explicitly sign out or erase browser/app storage; account linking/login will be added later.
