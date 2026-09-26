-- Cleanup: my_link_event_stats() was the Phase 6A analytics read. Phase 6B
-- replaced it with my_link_metrics() (same ownership check, more detail),
-- and nothing calls it any more. Dropping it removes an unused function
-- from what signed-in users can execute. No data is touched.

drop function if exists public.my_link_event_stats(uuid);
