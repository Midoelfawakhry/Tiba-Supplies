# Tiba AI assistant setup

## What this adds
- A shared assistant panel in the Ismailia main-office interface and the Ras Sedr branch interface.
- The main-office assistant receives a small operational summary and limited order fields; the branch assistant receives only the branch snapshot summary and read-only lists.
- The assistant is advisory only. It cannot create, update, cancel, assign, or redirect operational records.

## Required server secret
The Edge Function reads `GEMINI_API_KEY` only from Supabase Edge Function secrets. Do **not** put it in a `VITE_*` variable or in the client bundle.

Before using the assistant, add the key in Supabase Dashboard → Edge Functions → Secrets, or run locally from a trusted terminal:

```sh
supabase secrets set GEMINI_API_KEY="YOUR_KEY" --project-ref tnlcvwtphbunteifoonc
```

Do not commit the key or paste it into GitHub issues or source files. The function returns `AI_NOT_CONFIGURED` until this secret is present.

## Authorization and data boundaries
- Every request requires a valid Supabase session and an active `app_users` profile.
- Main-office requests require `ADMIN` or `HEAD_OFFICE`.
- Branch requests require `BRANCH`.
- The function does not read tables to build its own data snapshot; the UI sends a compact context based on the authenticated app's existing snapshot. The context is advisory and not an authoritative transaction source.
- Branch prompts explicitly prohibit suggesting branch-side operational mutations.
- Answers can be wrong; review them before making operational decisions.

## Validation
After merge, confirm the deployment workflow succeeds, set the secret, then test one request in each app with a real authorized account. Also verify anonymous requests and a role/audience mismatch are rejected.
