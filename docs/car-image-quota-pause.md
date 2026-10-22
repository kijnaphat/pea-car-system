# Temporary car-photo quota protection

Kamphaeng Saen only (`qsqshqbnatankvnxjjcy`):

- Existing reviewed photos continue to use the 90 immutable `/fleet-images/` files shipped with the website. No Storage request is required.
- Other image paths use a local type example or `/car-placeholder.svg`. Old valid `/api/car-image` URLs for unbundled photos redirect to that placeholder before any cache lookup, rendering or Storage download.
- Admin image selection, uploads and migration are paused. Existing car metadata edits, new cars/QR codes, trips, reports and Discord stay enabled. No images or database records were deleted by enabling this mode.
- The pause does not expire automatically. The billing reset date must be verified in Supabase before deciding to resume; a calendar month boundary is not sufficient.
- Thamaka and other project origins retain their previous image pipeline.

## Resuming after review

Change `isCarImageStoragePaused` in `lib/carImages.js` to return `false` for Kamphaeng Saen (or replace this temporary policy with a reviewed setting). Do not change the independent exact-project checks in `getBundledCarImageUrl`: existing static photos should keep working after the pause ends. Re-run the photo tests and build, update pause-specific tests deliberately, and deploy the reviewed change. Redirects for unbundled images have only a five-minute browser lifetime so resumption is not blocked by a year-long fallback cache.

## Limits of this protection

This blocks Storage photo reads initiated by this release of the main website, not all network traffic in the Supabase organization. Direct public Storage URLs, separately accessible older deployments, other projects and non-photo services can still consume quota. The Storage bucket and its permissions have not been changed. Previously accumulated usage is not erased. Do not describe this as a guaranteed 40 MB/day or zero-total-egress cap.
