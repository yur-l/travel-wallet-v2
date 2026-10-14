# Supabase files

- `v8-migration.sql` — run once on the current live project before deploying V8.
- `schema.sql` — consolidated fresh-project setup. Do not run this full file on the existing live project.
- `realtime.sql` — original Realtime publication helper; already applied in the current project.

V8 changes database permissions so active wallet members can manage shared-wallet content while wallet deletion/restoration remains owner-only.
