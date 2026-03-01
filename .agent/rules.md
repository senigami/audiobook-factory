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

## 3. Progress & State Consistency

- **Rounding Rule**: All progress values sent via WebSocket must be rounded to exactly 2 decimal places (whole percentages).
- **Milestone Thresholds**: Only broadcast progress updates when the value advances by at least 1% (0.01) to minimize network noise.
- **Clean Slate Protocol**: When a job is re-queued, reset, or recovered on startup, all metadata (logs, progress, timestamps, warning counts) MUST be wiped to prevent "98% stalls" or stale UI.
- **Disk as Source of Truth**: The UI (`ChapterCard`) must prioritize actual disk checks (is the file really there?) over potentially stale job status records.

## 4. Technical Environment

- **Virtual Environments**: Always execute backend tools (like `pytest`) using the local `./venv`.
- **Worker Synchronization**: When updating `j` objects in worker threads, immediately follow up with `update_job` to ensure the WebSocket bridge transmits the change to the frontend.

## 5. Documentation & Wiki

- **Wiki Accuracy**: Whenever a feature is added, modified, or the workflow changes, the corresponding wiki pages in the `wiki/` directory MUST be updated to ensure they remain accurate and helpful guides for users.
- **Maintain Sync**: Documentation is not an afterthought; it is part of the feature implementation.

## 6. Definition of Done

- **Work Integrity**: A task is NOT considered finished until:
  1. **Linting Passes**: No ESLint (frontend) or Ruff (backend) errors remain.
  2. **Backend Tests Pass**: `pytest` returns green for all relevant suites.
  3. **Frontend Tests Pass**: `npm test` returns green.
  4. **Wiki is Updated**: Relevant documentation reflects the current state of the app, and `wiki/Changelog.md` contains a **dated** entry for the changes.
