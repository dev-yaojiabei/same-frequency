# Same Frequency cloud records

Cloudflare D1 service for the GitHub Pages questionnaire. Production clients POST JSON to /api/cloud/{register,enter,list,save,record}. Health uses /api/cloud/health.

Names are NFKC-normalized, whitespace-collapsed and lowercased for uniqueness. This is deliberately a nickname lookup system, not authenticated accounts. Anyone who knows a nickname can read its records. Clients must show this and request affirmative shared-visibility consent before uploading answer codes. No public name index, destructive delete or record-update API exists.

Server validates answer codes, requires the chosen nickname to match one questionnaire, computes the report server-side and stores its snapshot. Duplicate pairs in either order and the same relationship return the existing record. A nickname can store at most 100 records. Requests are limited to 24KB. Production IP buckets are irreversibly hashed with the current ten-minute time bucket, capped at 120 requests, and expired buckets are pruned. CORS permits the Pages origin and local preview.

Database schema: db/schema.ts. Append-only Drizzle migrations: drizzle/. Queries use bound parameters. No runtime schema creation. server/shared contains the immutable v1 question codec and report generator shared with the static frontend.

Test: node --test tests/cloud.test.mjs (Node with built-in SQLite).
Build: npm run build. Publish via the Sites workflow, retaining .openai/hosting.json project ID.

Do not put actual questionnaires, reports, credentials or runtime data in source control.
