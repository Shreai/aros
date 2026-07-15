-- Safe, explicitly non-secret configuration exposed to enrolled edge devices.
ALTER TABLE edge_devices
  ADD COLUMN IF NOT EXISTS sync_interval_seconds INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS enabled_read_capabilities TEXT[] NOT NULL DEFAULT ARRAY['catalog.read','transactions.read']::TEXT[],
  ADD COLUMN IF NOT EXISTS config_version BIGINT NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'edge_devices_sync_interval_safe') THEN
    ALTER TABLE edge_devices ADD CONSTRAINT edge_devices_sync_interval_safe
      CHECK (sync_interval_seconds BETWEEN 30 AND 86400);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'edge_devices_config_version_positive') THEN
    ALTER TABLE edge_devices ADD CONSTRAINT edge_devices_config_version_positive CHECK (config_version > 0);
  END IF;
END $$;
