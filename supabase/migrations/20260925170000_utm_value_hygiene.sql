-- Phase 5A: UTM values are plain text, validated in the app (lib/validation/utm.ts).
-- The database keeps the invariants that matter even if a write bypasses the
-- app: no surrounding whitespace and no control characters. Existing rows
-- were written through stricter rules, so they already satisfy these checks.

alter table public.links
  add constraint links_utm_source_clean
    check (utm_source is null or (utm_source = btrim(utm_source) and utm_source !~ '[[:cntrl:]]')),
  add constraint links_utm_medium_clean
    check (utm_medium is null or (utm_medium = btrim(utm_medium) and utm_medium !~ '[[:cntrl:]]')),
  add constraint links_utm_campaign_clean
    check (utm_campaign is null or (utm_campaign = btrim(utm_campaign) and utm_campaign !~ '[[:cntrl:]]'));
