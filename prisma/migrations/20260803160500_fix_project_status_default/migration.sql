ALTER TABLE "WorkPilotProject"
ALTER COLUMN "status" SET DEFAULT 'Lead / Klärung';

CREATE UNIQUE INDEX "WorkPilotProject_organizationId_projectNumber_key"
ON "WorkPilotProject"("organizationId", "projectNumber");
