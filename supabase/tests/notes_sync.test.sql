-- Scenario tests for the notes sync functions (migration 018).
-- Run against a database that has migrations 001-018 applied:
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/notes_sync.test.sql
-- Everything runs inside one transaction that is rolled back, so no data is left behind.
-- Any failed ASSERT aborts with a message naming the scenario.

\set ON_ERROR_STOP on
BEGIN;

-- ── fixtures ────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.local');
INSERT INTO profiles (id, email) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.local')
ON CONFLICT (id) DO NOTHING;

-- builds a mutation; every call gets a fresh mutation_id unless one is given
CREATE FUNCTION pg_temp.mut(p_id uuid, p_base int, p_dirty text[], p_note jsonb,
                            p_ts bigint DEFAULT NULL, p_copy uuid DEFAULT NULL, p_mid uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'mutation_id', p_mid, 'id', p_id, 'base_version', p_base, 'dirty', to_jsonb(p_dirty),
    'note', jsonb_build_object('title','','content','','color','default','labels','[]'::jsonb,
                               'pinned',false,'archived',false,'deleted',false) || p_note,
    'client_updated_at', p_ts, 'copy_id', p_copy))
$$;

DO $t$
DECLARE
  alice constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  bob   constant uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  n1 constant uuid := '11111111-0000-4000-8000-000000000001';
  res jsonb; res2 jsonb; m jsonb; cnt int; copy_id uuid := '99999999-0000-4000-8000-000000000009';
BEGIN
  -- 1. create ---------------------------------------------------------------
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 0, '{title,content,labels}',
           '{"title":"Plan","content":"v1 text","labels":["b","a","a"]}'));
  ASSERT res->>'status' = 'applied', '1: create should apply: ' || res::text;
  ASSERT (res->'note'->>'version')::int = 1, '1: version 1';
  ASSERT res->'note'->'labels' = '["a","b"]'::jsonb, '1: labels are deduplicated and sorted: ' || (res->'note'->'labels')::text;
  ASSERT (SELECT user_id FROM notes WHERE id = n1) = alice, '1: owner is the authenticated user';

  -- 2. idempotent retry of the exact same mutation ------------------------------
  m := pg_temp.mut(n1, 1, '{content}', '{"title":"Plan","content":"v2 text","labels":["a","b"]}');
  res := notes_apply_mutation(alice, m);
  ASSERT res->>'status' = 'applied' AND (res->'note'->>'version')::int = 2, '2: first apply -> v2: ' || res::text;
  res2 := notes_apply_mutation(alice, m);
  ASSERT res2->>'status' = 'duplicate', '2: replay is a duplicate: ' || res2::text;
  ASSERT (SELECT version FROM notes WHERE id = n1) = 2, '2: replay must not bump the version';

  -- 3. different fields edited concurrently -> clean merge --------------------------
  -- device B still believes version 1 and only changes the title
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{title}', '{"title":"Plan B","content":"STALE","labels":["a","b"]}'));
  ASSERT res->>'status' = 'applied', '3: non-overlapping edits merge: ' || res::text;
  ASSERT res->'note'->>'title' = 'Plan B' AND res->'note'->>'content' = 'v2 text',
         '3: B title kept AND A content kept (stale content NOT written): ' || (res->'note')::text;
  ASSERT (res->'note'->>'version')::int = 3, '3: merged version 3';

  -- 4. same text field edited concurrently -> NO overwrite, conflict copy ---------------
  -- current server: content "v2 text" (rev 2). Device C based on version 1 edits content.
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{content}', '{"title":"Plan B","content":"C wrote this","labels":["a","b"]}', NULL, copy_id));
  ASSERT res->>'status' = 'conflict', '4: conflict reported: ' || res::text;
  ASSERT res->'note'->>'content' = 'v2 text', '4: server text NOT overwritten';
  ASSERT res->'conflicts' ? 'content', '4: conflicts lists content';
  ASSERT res->'copy'->>'content' = 'C wrote this' AND (res->'copy'->>'id')::uuid = copy_id, '4: loser text preserved in a copy: ' || coalesce(res->>'copy','null');
  ASSERT res->'copy'->>'title' = 'Plan B (conflict copy)', '4: copy is labelled';
  SELECT count(*) INTO cnt FROM notes WHERE user_id = alice; ASSERT cnt = 2, '4: exactly one copy created';
  -- retry with a new mutation id but the same copy_id must not create a second copy
  res2 := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{content}', '{"title":"Plan B","content":"C wrote this","labels":["a","b"]}', NULL, copy_id));
  SELECT count(*) INTO cnt FROM notes WHERE user_id = alice; ASSERT cnt = 2, '4: copy_id makes copy creation idempotent';

  -- 5. identical concurrent edit converges without a conflict ---------------------------------
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{content}', '{"title":"Plan B","content":"v2 text","labels":["a","b"]}'));
  ASSERT res->>'status' = 'applied' AND res->'copy' = 'null'::jsonb, '5: same value on both sides is not a conflict: ' || res::text;

  -- 6. labels: a lone edit applies; a CONCURRENT edit of the labels keeps every label (union) ------------------------
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{labels}', '{"title":"Plan B","content":"v2 text","labels":["q"]}'));
  ASSERT res->>'status' = 'applied' AND res->'note'->'labels' = '["q"]'::jsonb, '6a: nobody else touched labels, so the edit applies: ' || res::text;
  -- device D (still on version 1) now also changes the labels, but another device already changed them -> union
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{labels}', '{"title":"Plan B","content":"v2 text","labels":["z"]}'));
  ASSERT res->'note'->'labels' = '["q","z"]'::jsonb, '6b: concurrent label edits keep every label: ' || (res->'note'->'labels')::text;
  PERFORM notes_apply_mutation(alice, pg_temp.mut(n1, (SELECT version FROM notes WHERE id = n1), '{labels}', '{"title":"Plan B","content":"v2 text","labels":["a","b"]}'));  -- reset for later scenarios

  -- 7/8. delete vs concurrent edit ---------------------------------------------------------------------
  -- server content last changed at rev 2; a device with base 1 tries to delete -> must NOT delete
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{deleted}', '{"title":"Plan B","content":"v2 text","deleted":true}'));
  ASSERT res->>'status' = 'conflict' AND res->'note'->>'deleted' = 'false', '7: delete loses to a newer edit: ' || res::text;
  -- a device that HAS seen the latest version may delete
  res := notes_apply_mutation(alice, pg_temp.mut(n1, (SELECT version FROM notes WHERE id = n1), '{deleted}', '{"title":"Plan B","content":"v2 text","deleted":true}'));
  ASSERT res->>'status' = 'applied' AND res->'note'->>'deleted' = 'true', '8: delete applies when up to date: ' || res::text;
  ASSERT (SELECT deleted_at FROM notes WHERE id = n1) IS NOT NULL, '8: soft delete (tombstone kept)';

  -- 9. edit a note another device deleted -> restored, edit kept (fresh note so only delete-vs-edit is in play) -------------
  PERFORM notes_apply_mutation(alice, pg_temp.mut('88888888-0000-4000-8000-000000000008', 0, '{title,content}', '{"title":"keep me","content":"orig"}'));
  res := notes_apply_mutation(alice, pg_temp.mut('88888888-0000-4000-8000-000000000008', 1, '{deleted}', '{"title":"keep me","content":"orig","deleted":true}'));  -- device A deletes (v2)
  ASSERT res->'note'->>'deleted' = 'true', '9: setup delete: ' || res::text;
  res := notes_apply_mutation(alice, pg_temp.mut('88888888-0000-4000-8000-000000000008', 1, '{content}', '{"title":"keep me","content":"edited offline on device B"}'));  -- device B edits (still base 1)
  ASSERT res->>'status' = 'applied' AND (res->>'restored')::boolean AND res->'note'->>'deleted' = 'false',
         '9: edit beats a concurrent delete (note restored): ' || res::text;
  ASSERT res->'note'->>'content' = 'edited offline on device B', '9: edit preserved: ' || res::text;
  ASSERT res->'copy' = 'null'::jsonb, '9: no conflict copy needed';

  -- 10. explicit restore of a deleted note ------------------------------------------------------------------------------------
  PERFORM notes_apply_mutation(alice, pg_temp.mut('88888888-0000-4000-8000-000000000008', (SELECT version FROM notes WHERE id = '88888888-0000-4000-8000-000000000008'), '{deleted}', '{"title":"keep me","content":"edited offline on device B","deleted":true}'));
  res := notes_apply_mutation(alice, pg_temp.mut('88888888-0000-4000-8000-000000000008', 1, '{deleted}', '{"title":"keep me","content":"edited offline on device B","deleted":false}'));
  ASSERT res->'note'->>'deleted' = 'false', '10: explicit restore wins: ' || res::text;

  -- 11. flag conflicts are decided by who edited last, and reported -----------------------------------------
  PERFORM notes_apply_mutation(alice, pg_temp.mut(n1, (SELECT version FROM notes WHERE id = n1), '{pinned}', '{"title":"Edited after delete","content":"v2 text","pinned":true}', 2000));
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{pinned}', '{"title":"Edited after delete","content":"v2 text","pinned":false}', 1000));  -- older edit
  ASSERT res->>'status' = 'conflict' AND res->'note'->>'pinned' = 'true', '11: an OLDER offline flag change does not overwrite a newer one: ' || res::text;
  res := notes_apply_mutation(alice, pg_temp.mut(n1, 1, '{pinned}', '{"title":"Edited after delete","content":"v2 text","pinned":false}', 3000));  -- newer edit
  ASSERT res->>'status' = 'applied' AND res->'note'->>'pinned' = 'false', '11: a NEWER flag change wins: ' || res::text;

  -- 12. never-synced note that was deleted offline: nothing stored --------------------------------------------
  res := notes_apply_mutation(alice, pg_temp.mut('22222222-0000-4000-8000-000000000002', 0, '{title,deleted}', '{"title":"gone","deleted":true}'));
  ASSERT res->>'status' = 'applied' AND res->'note' IS NULL, '12: created+deleted offline stores nothing: ' || res::text;
  ASSERT NOT EXISTS (SELECT 1 FROM notes WHERE id = '22222222-0000-4000-8000-000000000002'), '12: no row';

  -- 13. note missing on the server (purged) but client has base>0 -> recreated -----------------------------------
  res := notes_apply_mutation(alice, pg_temp.mut('33333333-0000-4000-8000-000000000003', 5, '{title,content}', '{"title":"Back","content":"recreated"}'));
  ASSERT res->>'status' = 'applied' AND res->'note'->>'content' = 'recreated', '13: recreated from the client snapshot: ' || res::text;

  -- 14. security: another user cannot touch, overwrite or replay -------------------------------------------------
  res := notes_apply_mutation(bob, pg_temp.mut(n1, 0, '{title}', '{"title":"HACKED"}'));
  ASSERT res->>'status' = 'rejected' AND res->>'error' = 'forbidden', '14: bob cannot write alice''s note id: ' || res::text;
  ASSERT (SELECT title FROM notes WHERE id = n1) <> 'HACKED', '14: alice''s note untouched';
  ASSERT (SELECT user_id FROM notes WHERE id = n1) = alice, '14: ownership unchanged';
  m := pg_temp.mut('44444444-0000-4000-8000-000000000004', 0, '{title}', '{"title":"alice private"}');
  PERFORM notes_apply_mutation(alice, m);
  res := notes_apply_mutation(bob, m);  -- replay alice's mutation id as bob
  ASSERT res->>'status' = 'rejected', '14: a mutation id cannot be replayed across users: ' || res::text;
  ASSERT notes_pull(bob, NULL, NULL, 500) = '[]'::jsonb, '14: bob sees none of alice''s notes via pull';
  BEGIN
    UPDATE notes SET user_id = bob WHERE id = n1;
    ASSERT false, '14: reassigning user_id must be impossible';
  EXCEPTION WHEN raise_exception THEN NULL; END;

  -- 15. validation: bad input is rejected and writes nothing ---------------------------------------------------------
  FOREACH m IN ARRAY ARRAY[
    pg_temp.mut('55555555-0000-4000-8000-000000000005', 0, '{title}', '{"title":"x","color":"neon"}'),
    pg_temp.mut('55555555-0000-4000-8000-000000000005', 0, '{title}', jsonb_build_object('title', repeat('x', 501))),
    pg_temp.mut('55555555-0000-4000-8000-000000000005', 0, '{content}', jsonb_build_object('content', repeat('x', 100001))),
    pg_temp.mut('55555555-0000-4000-8000-000000000005', 0, '{user_id}', '{"title":"x"}'),
    pg_temp.mut('55555555-0000-4000-8000-000000000005', 0, '{labels}', '{"labels":[""]}'),
    pg_temp.mut('55555555-0000-4000-8000-000000000005', 0, '{labels}', jsonb_build_object('labels', (SELECT jsonb_agg('l' || g) FROM generate_series(1,21) g))),
    pg_temp.mut('55555555-0000-4000-8000-000000000005', 0, '{pinned}', '{"pinned":"yes"}'),
    '{"mutation_id":"not-a-uuid","id":"x"}'::jsonb
  ] LOOP
    res := notes_apply_mutation(alice, m);
    ASSERT res->>'status' = 'rejected', '15: invalid mutation must be rejected: ' || m::text || ' => ' || res::text;
  END LOOP;
  ASSERT NOT EXISTS (SELECT 1 FROM notes WHERE id = '55555555-0000-4000-8000-000000000005'), '15: nothing written';

  -- 16. a bad mutation in a batch does not poison the rest ------------------------------------------------------------------
  res := notes_apply_batch(alice, jsonb_build_array(
           '{"mutation_id":"zzz"}'::jsonb,
           pg_temp.mut('66666666-0000-4000-8000-000000000006', 0, '{title}', '{"title":"batch ok"}')));
  ASSERT res->0->>'status' = 'rejected' AND res->1->>'status' = 'applied', '16: batch isolation: ' || res::text;

  -- 17. pull: user isolation, ordering, tombstones, pagination -----------------------------------------------------------------
  res := notes_pull(alice, NULL, NULL, 500);
  ASSERT jsonb_array_length(res) >= 5, '17: pull returns alice''s notes';
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(res) e WHERE e->>'title' = 'HACKED'), '17: no foreign data';
  res := notes_pull(alice, NULL, NULL, 2);
  ASSERT jsonb_array_length(res) = 2, '17: limit respected';
  res2 := notes_pull(alice, (res->1->>'updated_at')::timestamptz, (res->1->>'id')::uuid, 500);
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(res2) e WHERE e->>'id' IN (res->0->>'id', res->1->>'id')), '17: cursor continues after the last seen row';
  ASSERT jsonb_array_length(res2) + 2 = jsonb_array_length(notes_pull(alice, NULL, NULL, 500)), '17: pagination loses nothing';
  PERFORM notes_apply_mutation(alice, pg_temp.mut('77777777-0000-4000-8000-000000000007', 0, '{title}', '{"title":"to delete"}'));
  PERFORM notes_apply_mutation(alice, pg_temp.mut('77777777-0000-4000-8000-000000000007', 1, '{deleted}', '{"title":"to delete","deleted":true}'));
  ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(notes_pull(alice, NULL, NULL, 500)) e WHERE e->>'id' = '77777777-0000-4000-8000-000000000007' AND (e->>'deleted')::boolean),
         '17: tombstones are delivered so other devices can delete';
  RAISE NOTICE 'notes sync scenarios 1-17: OK';
END
$t$;

-- ── 18. database privileges --------------------------------------------------------------------------
DO $t$
DECLARE ok boolean;
BEGIN
  -- a signed-in browser (authenticated role) must NOT be able to call the sync functions...
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM notes_apply_mutation('bbbbbbbb-0000-4000-8000-000000000002', '{}'::jsonb);
    ASSERT false, '18: authenticated must not execute notes_apply_mutation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM notes_pull('aaaaaaaa-0000-4000-8000-000000000001', NULL, NULL, 10);
    ASSERT false, '18: authenticated must not execute notes_pull';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- ...nor write the table directly
  BEGIN
    INSERT INTO notes (id, user_id, title) VALUES (gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000002', 'direct');
    ASSERT false, '18: authenticated must not INSERT directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE notes SET title = 'x';
    ASSERT false, '18: authenticated must not UPDATE directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- RLS: reads are limited to the caller's own rows
  PERFORM set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);
  ASSERT (SELECT count(*) FROM notes) = 0, '18: bob reads none of alice''s notes under RLS';
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
  ASSERT (SELECT count(*) FROM notes) > 0, '18: alice reads her own notes under RLS';
  ASSERT (SELECT count(*) FROM notes WHERE user_id <> 'aaaaaaaa-0000-4000-8000-000000000001') = 0, '18: and only hers';
  -- anon sees nothing
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM count(*) FROM notes;
    ASSERT false, '18: anon must not read notes';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  -- the idempotency table is not exposed at all
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM count(*) FROM note_mutations;
    ASSERT false, '18: note_mutations must not be readable by clients';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  -- the service role (the API) can
  SET LOCAL ROLE service_role;
  PERFORM notes_pull('aaaaaaaa-0000-4000-8000-000000000001', NULL, NULL, 10);
  RESET ROLE;
  RAISE NOTICE 'notes privileges + RLS: OK';
END
$t$;

ROLLBACK;
