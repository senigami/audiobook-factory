# Persistent Coding Rules

These rules apply to all development activities in this repository.

## 1. Test-Driven Updates
- **Mandatory Verification**: Every code update must be verified by running the existing test suite.
- **Continuous Alignment**: When writing new code or modifying existing logic, you MUST update or create tests to reflect these changes.
- **No Compromise**: If a test fails, do NOT modify the test to match a broken or incorrect frontend implementation just to make it pass.
- **Logic First**: Always ensure the underlying business logic is correct first. If there is a discrepancy between the logic and the frontend, the frontend should be updated to align with the correct logic, never the other way around.

## 2. Execution Protocol
- Run `pytest` after any backend or logic changes.
- Run frontend build/tests (if applicable) after any UI changes.
- Document verification results in the task walkthrough.
