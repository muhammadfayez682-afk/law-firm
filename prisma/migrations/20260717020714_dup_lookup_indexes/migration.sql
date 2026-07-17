-- CreateIndex
CREATE INDEX "case_parties_phone_idx" ON "case_parties"("phone");

-- CreateIndex
CREATE INDEX "case_parties_identityNumber_idx" ON "case_parties"("identityNumber");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "intake_requests_clientPhone_idx" ON "intake_requests"("clientPhone");
