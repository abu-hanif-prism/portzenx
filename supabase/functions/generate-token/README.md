# generate-token

Validates a PortZen customer password, inserts a new `edit_tokens` row, and returns a 24-hour magic edit link.

Required Edge Function secrets:

```bash
supabase secrets set SITE_URL=https://portzen.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase at runtime.
