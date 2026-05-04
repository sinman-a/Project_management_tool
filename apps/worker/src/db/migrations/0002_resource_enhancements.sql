-- PPM Tool — Resource enhancements
-- Migration: 0002_resource_enhancements

ALTER TABLE resources ADD COLUMN role TEXT;
ALTER TABLE resources ADD COLUMN seniority_level TEXT;
ALTER TABLE resources ADD COLUMN superpower TEXT;
ALTER TABLE resources ADD COLUMN start_date TEXT;
ALTER TABLE resources ADD COLUMN location TEXT;
ALTER TABLE resources ADD COLUMN project_allocation REAL DEFAULT 100;
ALTER TABLE resources ADD COLUMN avatar_url TEXT;
ALTER TABLE resources ADD COLUMN archetype TEXT;
ALTER TABLE resources ADD COLUMN motto TEXT;
