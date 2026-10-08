# Supabase setup

## Existing Travel Wallet project

Your core schema is already installed and tested. To turn on live syncing, run only:

`realtime.sql`

in Supabase **SQL Editor → New query**.

This adds the five Travel Wallet tables to the `supabase_realtime` publication. It does not delete wallet data.

## Fresh Supabase project

For a brand-new project, run `schema.sql`. It contains the current canonical schema, RLS fixes, join-wallet RPC fixes, and realtime publication setup.

Do not rerun the entire `schema.sql` on the current production project unless you are intentionally rebuilding it.
