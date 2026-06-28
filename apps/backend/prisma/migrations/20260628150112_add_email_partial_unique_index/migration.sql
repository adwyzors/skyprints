-- Enforce email uniqueness only for non-deleted (active) users.
-- This allows email reuse after soft-delete without breaking the unique constraint.
CREATE UNIQUE INDEX "User_email_active_unique" ON "User" (email) WHERE "deletedAt" IS NULL;
