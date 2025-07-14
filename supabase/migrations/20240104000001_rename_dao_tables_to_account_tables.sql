-- Migration: Rename DAO tables to Account tables
-- This script renames all dao_* tables to account_* tables while preserving all data

-- =======================
-- 1. Rename main daos table to accounts
-- =======================
ALTER TABLE public.daos RENAME TO accounts;

-- =======================
-- 2. Rename shared infrastructure tables
-- =======================
ALTER TABLE public.dao_sync_logs RENAME TO account_sync_logs;
ALTER TABLE public.dao_sync_stats RENAME TO account_sync_stats;

-- =======================
-- 3. Rename all individual DAO tweet tables to account tweet tables
-- =======================
ALTER TABLE public.dao_athenadao_tweets RENAME TO account_athenadao_tweets;
ALTER TABLE public.dao_beeardai_tweets RENAME TO account_beeardai_tweets;
ALTER TABLE public.dao_bioprotocol_tweets RENAME TO account_bioprotocol_tweets;
ALTER TABLE public.dao_cerebrumdao_tweets RENAME TO account_cerebrumdao_tweets;
ALTER TABLE public.dao_cryodao_tweets RENAME TO account_cryodao_tweets;
ALTER TABLE public.dao_curetopiadao_tweets RENAME TO account_curetopiadao_tweets;
ALTER TABLE public.dao_d1ckdao_tweets RENAME TO account_d1ckdao_tweets;
ALTER TABLE public.dao_dalyadao_tweets RENAME TO account_dalyadao_tweets;
ALTER TABLE public.dao_dogyearsdao_tweets RENAME TO account_dogyearsdao_tweets;
ALTER TABLE public.dao_fatdao_tweets RENAME TO account_fatdao_tweets;
ALTER TABLE public.dao_gingersciencedao_tweets RENAME TO account_gingersciencedao_tweets;
ALTER TABLE public.dao_gliodao_tweets RENAME TO account_gliodao_tweets;
ALTER TABLE public.dao_hairdao_tweets RENAME TO account_hairdao_tweets;
ALTER TABLE public.dao_hempydotscience_tweets RENAME TO account_hempydotscience_tweets;
ALTER TABLE public.dao_kidneydao_tweets RENAME TO account_kidneydao_tweets;
ALTER TABLE public.dao_longcovidlabsdao_tweets RENAME TO account_longcovidlabsdao_tweets;
ALTER TABLE public.dao_mesoreefdao_tweets RENAME TO account_mesoreefdao_tweets;
ALTER TABLE public.dao_microbiomedao_tweets RENAME TO account_microbiomedao_tweets;
ALTER TABLE public.dao_microdao_tweets RENAME TO account_microdao_tweets;
ALTER TABLE public.dao_moleculedao_tweets RENAME TO account_moleculedao_tweets;
ALTER TABLE public.dao_mycodao_tweets RENAME TO account_mycodao_tweets;
ALTER TABLE public.dao_nootropicsdao_tweets RENAME TO account_nootropicsdao_tweets;
ALTER TABLE public.dao_psydao_tweets RENAME TO account_psydao_tweets;
ALTER TABLE public.dao_quantumbiodao_tweets RENAME TO account_quantumbiodao_tweets;
ALTER TABLE public.dao_reflexdao_tweets RENAME TO account_reflexdao_tweets;
ALTER TABLE public.dao_sleepdao_tweets RENAME TO account_sleepdao_tweets;
ALTER TABLE public.dao_spectruthaidao_tweets RENAME TO account_spectruthaidao_tweets;
ALTER TABLE public.dao_spinedao_tweets RENAME TO account_spinedao_tweets;
ALTER TABLE public.dao_stemdao_tweets RENAME TO account_stemdao_tweets;
ALTER TABLE public.dao_valleydao_tweets RENAME TO account_valleydao_tweets;
ALTER TABLE public.dao_vitadao_tweets RENAME TO account_vitadao_tweets;
ALTER TABLE public.dao_vitafastbio_tweets RENAME TO account_vitafastbio_tweets;
ALTER TABLE public.dao_vitarnabio_tweets RENAME TO account_vitarnabio_tweets;

-- =======================
-- 4. Update constraint names (primary keys will be automatically renamed)
-- =======================
-- The primary key constraints will be automatically renamed by PostgreSQL
-- but we should verify they follow the new naming convention

-- =======================
-- 5. Update any functions that reference the old table names
-- =======================
-- Note: If you have any existing functions that reference dao_* tables,
-- they will need to be updated separately. Based on your migration files,
-- you might have functions like:
-- - get_dao_twitter_table_name() -> get_account_twitter_table_name()
-- - create_dao_twitter_table() -> create_account_twitter_table()
-- - trigger_create_dao_twitter_table() -> trigger_create_account_twitter_table()

-- =======================
-- 6. Create updated helper functions (if needed)
-- =======================
-- These functions would need to be updated to work with the new table names
-- You'll need to update these in your existing migration files or create new ones

-- =======================
-- 7. Add comments for documentation
-- =======================
COMMENT ON TABLE public.accounts IS 'Renamed from daos - stores account/community information';
COMMENT ON TABLE public.account_sync_logs IS 'Renamed from dao_sync_logs - stores sync operation logs';
COMMENT ON TABLE public.account_sync_stats IS 'Renamed from dao_sync_stats - stores sync statistics';

-- =======================
-- 8. Verify the migration completed successfully
-- =======================
-- You can run these queries to verify the migration worked:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'account_%';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'dao_%';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts'; 