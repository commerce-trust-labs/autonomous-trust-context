# Deploy runbook (fixture)

1. Verify the release was approved through the R2 human gate.
2. Execute the registered `release_service` action — never a free-form command.
3. Verify recovery: health, error rate, and traffic within the recovery window.
