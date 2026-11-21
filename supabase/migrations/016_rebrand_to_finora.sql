-- ============================================================
-- 016: Rebrand the PRODUCT from "WealthOS" to "Finora"
--      (the parent company keeps the name WEALTHOS)
--
-- Migrations 001/008/009/010 were edited so FRESH installs already contain the new text.
-- This migration brings an EXISTING database (one that already ran the old versions)
-- to the same state. It is idempotent: on a fresh install, or a second run, it changes nothing.
--
-- What it does
--   1. Legal documents: the product becomes Finora, while the contracting / owning / operating
--      party becomes WEALTHOS. Every changed document gets version + 1 so you can see it changed
--      (and, if you track acceptance per version, re-prompt users).
--   2. AI executive prompts (agents.system_prompt): "WealthOS" -> "Finora".
--   3. Newsletter default sender name and existing drafts/rows named "WealthOS" -> "Finora".
--   4. system_config: app_name and support_email.
--
-- NOTE FOR YOUR LAWYER: step 1 changes who the documents say the contracting party is.
-- Have the Terms, Privacy Policy, Disclaimer, Refund Policy and Copyright Notice reviewed
-- before launch. This migration only makes the wording consistent with the new structure.
-- ============================================================

DO $do$
DECLARE
  r RECORD;
  txt TEXT;
  i INT;
  pairs TEXT[][] := ARRAY[
      ARRAY[$q$use of WealthOS (the &quot;Service&quot;).$q$, $q$use of Finora (the &quot;Service&quot;), a software product owned and operated by WEALTHOS (&quot;WEALTHOS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).$q$],
      ARRAY[$q$is owned by WealthOS and protected$q$, $q$is owned by WEALTHOS and protected$q$],
      ARRAY[$q$<p>WealthOS provides tools$q$, $q$<p>Finora provides tools$q$],
      ARRAY[$q$<p>WealthOS is a software tool$q$, $q$<p>Finora is a software tool$q$],
      ARRAY[$q$While we aim for accuracy, WealthOS does not guarantee$q$, $q$While we aim for accuracy, Finora does not guarantee$q$],
      ARRAY[$q$<strong>WealthOS is not a registered investment adviser, broker-deal$q$, $q$<strong>Finora, operated by WEALTHOS, is not a registered investment adviser, broker-deal$q$],
      ARRAY[$q$WealthOS is not a registered investment adviser or broker-de$q$, $q$Finora, operated by WEALTHOS, is not a registered investment adviser or broker-de$q$],
      ARRAY[$q$relationship between you and WealthOS.</strong>$q$, $q$relationship between you and Finora or WEALTHOS.</strong>$q$],
      ARRAY[$q$relationship is created between you and WealthOS by using the Service$q$, $q$relationship is created between you and Finora or WEALTHOS by using the Service$q$],
      ARRAY[$q$WealthOS does not initiate bank transfers$q$, $q$Finora does not initiate bank transfers$q$],
      ARRAY[$q$explains how WealthOS (&quot;WealthOS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)$q$, $q$explains how WEALTHOS (&quot;WEALTHOS,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), the operator of Finora,$q$],
      ARRAY[$q$Subscription payments made to WealthOS are$q$, $q$Subscription payments made to WEALTHOS for Finora are$q$],
      ARRAY[$q$a paid WealthOS plan$q$, $q$a paid Finora plan$q$],
      ARRAY[$q$© 2026 WealthOS. All rights reserved.</p>$q$, $q$© 2026 WEALTHOS. All rights reserved.</p><p style="margin-top:16px">Finora is a product of WEALTHOS.</p>$q$],
      ARRAY[$q$that make up the WealthOS Service are the property of WealthOS or its licensors$q$, $q$that make up the Finora Service are the property of WEALTHOS or its licensors$q$],
      ARRAY[$q$this notice covers the WealthOS platform itself$q$, $q$this notice covers the Finora platform itself$q$]
  ];
BEGIN
  -- 1. legal documents -----------------------------------------------------------------
  IF to_regclass('public.legal_documents') IS NOT NULL THEN
    FOR r IN SELECT id, content FROM legal_documents LOOP
      txt := r.content;
      FOR i IN 1..array_length(pairs, 1) LOOP
        txt := replace(txt, pairs[i][1], pairs[i][2]);
      END LOOP;
      txt := replace(txt, 'WealthOS', 'Finora');   -- safety net for any phrase not listed above
      IF txt <> r.content THEN
        UPDATE legal_documents
           SET content = txt, version = version + 1, updated_at = NOW(), published_at = NOW()
         WHERE id = r.id;
      END IF;
    END LOOP;
  END IF;

  -- 2. AI executive prompts ------------------------------------------------------------
  IF to_regclass('public.agents') IS NOT NULL THEN
    UPDATE agents SET system_prompt = replace(system_prompt, 'WealthOS', 'Finora'), updated_at = NOW()
     WHERE system_prompt LIKE '%WealthOS%';
  END IF;

  -- 3. newsletters ---------------------------------------------------------------------
  IF to_regclass('public.newsletters') IS NOT NULL THEN
    ALTER TABLE newsletters ALTER COLUMN from_name SET DEFAULT 'Finora';
    UPDATE newsletters SET from_name = 'Finora' WHERE from_name = 'WealthOS';
  END IF;

  -- 4. system config -------------------------------------------------------------------
  IF to_regclass('public.system_config') IS NOT NULL THEN
    UPDATE system_config SET value = '"Finora"'::jsonb, updated_at = NOW()
     WHERE key = 'app_name' AND value = '"WealthOS"'::jsonb;
    UPDATE system_config SET value = '"support@finora.app"'::jsonb, updated_at = NOW()
     WHERE key = 'support_email' AND value = '"support@wealthos.ai"'::jsonb;
  END IF;
END
$do$;
