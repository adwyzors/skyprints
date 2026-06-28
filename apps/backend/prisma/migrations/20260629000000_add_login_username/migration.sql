-- AlterTable
ALTER TABLE "Login" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Login_username_key" ON "Login"("username");
