-- 001: reviews get a moderation state. A review a customer writes starts as PENDING (hidden) until the owner approves it
-- in Admin -> Reviews. Reviews that already exist stay APPROVED, so nothing visible today changes. Additive only.
ALTER TABLE reviews ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'APPROVED' AFTER comment;
