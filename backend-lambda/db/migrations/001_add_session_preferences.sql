-- Migration: Add preferences and frame_count to sessions table
-- Date: 2025-11-14

ALTER TABLE sessions
ADD COLUMN frame_count INT DEFAULT 0,
ADD COLUMN voice VARCHAR(50),
ADD COLUMN commentary_style VARCHAR(50),
ADD COLUMN speaking_rate DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN pitch DECIMAL(4,1) DEFAULT 0.0,
ADD COLUMN volume INT DEFAULT 100;
