# Security deployment checklist

The application is configured with browser-facing Supabase credentials. The
`NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally public; it is safe only when
Supabase Row Level Security (RLS) is enabled and its policies are correct.

## Required Supabase settings

- Enable RLS on every application table: `cars`, `staff`, `tasks`,
  `departments`, `operation_areas`, `trip_logs`, `repair_logs`, and
  `report_signatures`.
- Keep the `service_role` key out of `.env.local`, Vercel client variables,
  GitHub, and all browser code. If it has ever been exposed, rotate it.
- For admin-only create, update, and delete policies, require an authenticated
  user with an explicit `admin` role (for example, a value in `app_metadata`),
  not merely an email address stored in a public table.
- Make `take_car_out` and `return_car` validate the caller, vehicle state,
  mileage ranges, and allowed fields inside the database function. Revoke
  `EXECUTE` from `anon` unless anonymous QR actions are intentionally supported.
- Restrict public reads to the minimum columns required by the Home page. In
  particular, do not allow public access to staff phone numbers or signatures
  unless that is an explicit business requirement.
- Enable email confirmation, strong-password rules, MFA for administrators,
  and Auth rate limiting / CAPTCHA in Supabase Dashboard.

## Required Vercel settings

- Store only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
  client environment variables. Do not expose privileged keys.
- Turn on deployment protection for previews and keep production access limited
  to the intended project members.
- Review environment variables and Git integrations regularly; revoke old
  tokens and unused collaborators.

## Verification before production

1. Test every table and RPC with an anonymous user, a normal authenticated user,
   and an administrator. Each must be denied access outside its role.
2. Confirm an anonymous browser cannot update `cars`, `staff`, or reports by
   calling the Supabase REST endpoint directly.
3. Re-run `npm audit --omit=dev` before deployment and keep Next.js patched.
