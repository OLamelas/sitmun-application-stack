# Project Progress - SITMUN Application Stack

## Active Features

### 1. MIA (More Info Advanced) - ~98% complete
- Status: See `state/mia-status.md`
- All builds pass (viewer + admin + backend tests)
- Liquibase validation passes
- Security fixes applied: P0-A (DOMPurify), P0-B (/execute-child admin-only), P1 (URL encoding)
- Admin form rewritten as pure container (no parent/child, no query fields)
- i18n updated across all 5 languages
- **FIXED**: typeId serialization — added to ALL 6 task mappers (was missing from 4 query/edit mappers)
- **VERIFIED**: MIA popup appears in viewer after backend rebuild
- **DONE**: Debug console.warn logging removed from viewer
- Pending: commit

### 2. Template (Plantilla) - ~85% complete
- Status: See `state/template-status.md`
- Reconciliation review done: plan is stale (ID 7 vs actual 15) but ~85% criteria met
- Liquibase migrations done (task type 15, relation aliases)
- Backend DTOs/services/controllers exist and pass tests
- Admin template UI components/spec files exist
- Missing: standalone linked-task validation, seed CSV verification, end-to-end test

## Completed (previous sessions)

- Existing task types (basic, query, more-info, etc.) fully implemented
- Existing admin UI patterns established
- Existing viewer control handler patterns established
- Liquibase migration infrastructure for both PostgreSQL and Oracle

## Architecture decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| MIA is always a container - no parent/child | Simplifies UX, matches user expectation of grouping tasks | 2026-05-06 |
| Template uses ID 15 (not 7 from original plan) | ID 7 was `informe/report` in dev data; 15 is next available | 2026-04-16 |
| Template HTML stored in `TAS_PARAMS` | Reuse existing task model, no new tables | 2026-04-16 |
| Template relations via `STM_TASKREL` | Same pattern as other task relationships | 2026-04-16 |
| Handlebars for template rendering | Java Handlebars library, flat context keys | 2026-04-16 |
| Nesting depth limit = 3 | Prevents infinite recursion, practical limit | 2026-04-16 |
| MIA gets separate task type (16) | Clean separation from existing more-info | 2026-04-16 |
| DOMPurify for viewer HTML sanitization | Prevents XSS from backend-rendered HTML | 2026-05-06 |
| /execute-child admin-only | Viewer uses /more-info-advanced/render; execute-child is admin preview only | 2026-05-06 |

## Next sessions should start here

1. Commit all submodules + stack-level changes.
2. Run admin template component specs.
3. Verify seed CSVs include task type 15.
4. Browser-verify MIA admin form at localhost:4200.

## Harness Engineering

This framework was activated on 2026-05-06. All future work should follow the orchestrator -> subagent pattern defined in `.sitmun-harness/`.
