-- Initialize the database with necessary extensions
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create the scheduling_copilot database if it doesn't exist
-- Note: This file is run when the container is first created