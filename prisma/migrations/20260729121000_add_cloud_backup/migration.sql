CREATE TABLE "CloudBackupConnection" (
    "id" TEXT NOT NULL DEFAULT 'google-drive',
    "provider" TEXT NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "accountEmail" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "driveFileId" TEXT,
    "driveFileName" TEXT NOT NULL DEFAULT 'QuoteFlow-latest-backup.tar.gz',
    "driveWebViewLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "lastBackupAt" TIMESTAMP(3),
    "lastBackupSize" BIGINT,
    "lastChecksum" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudBackupConnection_pkey" PRIMARY KEY ("id")
);
