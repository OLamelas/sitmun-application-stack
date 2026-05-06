# Template (Plantilla) - Status

## Overview

New task type "Plantilla" (Template, TTY_ID=15) that stores Handlebars HTML in `STM_TASK.TAS_PARAMS`, links query/template children through `STM_TASKREL`, allows manual execution/preview from admin UI, and blocks linked API tasks with authentication.

Reference plan: `docs/plans/2026-04-16-plantilla-task-implementation.md` (12 tasks)

## What's done

### Liquibase migrations (stack repo) - DONE
- [x] `40_add_template_task_type.yaml` - adds task type 15 to STM_TSK_TYP (development profile)
- [x] `40_add_template_task_type/15_TemplateTaskDefinition.json` - task spec
- [x] `41_add_template_reference_alias.yaml` - adds relation type aliases
- [x] `08_add_template_task_type.yaml` - postgres profile equivalent
- [x] `08_add_template_task_type/` - postgres profile task spec
- [x] `09_add_template_reference_alias.yaml` - postgres profile relations
- [x] Oracle profile equivalents (`08_`, `09_`, `11_`, `12_` changelogs)

### Backend (sitmun-backend-core) - IMPLEMENTED, NEEDS REVIEW/TESTS
- [x] `DomainConstants.Tasks.TASK_TYPE_ID_TEMPLATE = 15`
- [x] `DomainConstants.Tasks.PROPERTY_TEMPLATE_HTML = "templateHtml"`
- [x] `DomainConstants.Tasks.RELATION_TYPE_TEMPLATE_TASK = "template-task"`
- [x] `DomainConstants.Tasks.RELATION_TYPE_TEMPLATE_NESTED = "template-nested"`
- [x] Template DTOs exist: `TemplateLinkedTaskDto`, `TemplatePreviewRequestDto`, `TemplatePreviewResponseDto`, `TemplateTaskExecutionRequestDto`, `TemplateTaskExecutionResponseDto`
- [x] `TemplatePreviewController` exposes template preview and child execution endpoints
- [x] `AdminTaskExecutionService`, `TemplateExecutionService`, `TemplateRenderService`, and `TemplateRequestCoordinatesService` exist

### Admin frontend (sitmun-admin-app) - PRESENT IN SUBMODULE, NEEDS REVIEW/TESTS
- [x] `tasks-template` list component exists
- [x] `task-template-form` exists
- [x] `query-execution-card` exists
- [x] `template-editor` exists
- [x] Component specs exist for template list/form/card/editor

## Plan tasks status (from docs/plans/...)

| Task | Description | Status |
|------|-------------|--------|
| 1 | Promote Task Type to Template in seed data | PARTIAL/CHANGED - actual implementation uses ID 15, not plan ID 7 |
| 2 | Extend Task Properties Contract for Template HTML | APPEARS IMPLEMENTED - verify frontend property model/tests |
| 3 | Add Template Relations and Backend DTOs | APPEARS IMPLEMENTED - verify tests |
| 4 | Add Backend Service to Resolve Linked Tasks | APPEARS IMPLEMENTED inside `TemplateExecutionService` - review against spec |
| 5 | Add Backend Query Execution for Admin Preview | APPEARS IMPLEMENTED - review/test |
| 6 | Add Java Handlebars Rendering with Depth Limit 3 | APPEARS IMPLEMENTED - review/test |
| 7 | Add Admin List, Route, Form Shell | PRESENT - review/test |
| 8 | Add Reusable Query Execution Card Component | PRESENT - review/test |
| 9 | Implement Linked-Tasks Table and Relation Persistence | UNKNOWN - inspect form/service behavior |
| 10 | Add WYSIWYG HTML Editor and Notes | PRESENT - review/test |
| 11 | Wire Preview Pane to Executions and Render Endpoint | UNKNOWN/PARTIAL - inspect form behavior |
| 12 | Full Verification | NOT DONE |

## Important notes

- Plan was written with catalog ID 7, but actual implementation uses ID 15.
- The plan is stale: many backend/admin pieces already exist and need review rather than fresh implementation.
- Need verify whether the implemented frontend/backend behavior matches the original acceptance criteria.

## Reconciliation review (2026-05-06 session 2)

### Acceptance criteria MET
- Task type constant ID 15 (DomainConstants)
- Template HTML property + editor state constants
- Template DTOs (preview request/response, execution request/response, linked task)
- Relation type constants (template-task, template-nested)
- Preview controller with /execute-child and /preview endpoints
- Handlebars rendering (jknack library)
- Max nesting depth 3 enforced
- Flat context keys + $param lookups
- HTML result placeholders rendered unescaped ({{{...}}})
- Admin list/form/card/editor shell components
- Backend tests: TemplateExecutionServiceTest, TemplateRenderServiceTest
- Frontend specs for template components

### Acceptance criteria PARTIALLY MET
- Linked-task validation: embedded in TemplateExecutionService (plan wanted separate TemplateLinkedTaskService)
- Linked-tasks table with auth-blocking UI: component exists but rule enforcement needs spec review
- Preview pane wired to executions: form exists but placeholder detection and status chips unverified

### MISSING
- Standalone TemplateLinkedTaskService (pre-link guard that rejects cartography children, auth-API tasks)
- Seed data CSVs may need verification for task type 15 presence
- Plan's Task 12 (full end-to-end verification) not done

### Risky divergences
- Plan says ID 7, actual is 15 — plan is stale
- Service name: plan says AdminTaskExecutionService, actual is TemplateExecutionService (also handles MIA)
- MIA logic merged into TemplateExecutionService creates coupling between features
- No pre-link validation — invalid links fail at execution time only

## Next step

1. Decide whether to create standalone linked-task validation or accept current runtime-validation approach
2. Verify seed data CSVs include task type 15
3. Run admin template component specs
4. Consider splitting TemplateExecutionService (MIA vs Template) if coupling causes issues

## Current git state

- Liquibase files are uncommitted in stack repo
- Backend template services have uncommitted modifications
- Template admin code exists in the admin submodule and appears already committed in that submodule baseline
