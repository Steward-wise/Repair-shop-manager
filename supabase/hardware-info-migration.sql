-- Add hardware_info jsonb column to phone_checks for extended device data
ALTER TABLE phone_checks ADD COLUMN IF NOT EXISTS hardware_info jsonb DEFAULT '{}'::jsonb;
