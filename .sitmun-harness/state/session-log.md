# Session Log

## 2026-05-06 - Harness Activation And State Recovery

### Context

- IDE/OpenCode was moved one level above `sitmun-application-stack` because the previous path was crashing.
- `AGENTS.md` now lives at the parent workspace and notes that source code is inside `/sitmun-application-stack`.
- User requested Harness Engineering workflow from now on: orchestrator, delegated agents, filtered context, persistent markdown history, and verification.

### Actions Taken

- Created `.sitmun-harness/` inside `sitmun-application-stack`.
- Added orchestrator, implementor, reviewer, and tester role files.
- Added persistent state files for project progress, MIA, Template, and context brief.
- Added `Critical Session Bootstrap` to the parent `AGENTS.md` so new OpenCode sessions must enter `sitmun-application-stack/`, read `.sitmun-harness/`, and treat the main assistant as Orchestrator.
- Audited uncommitted changes at stack and submodule level.
- Delegated a focused MIA audit to a subagent.
- Updated state files after discovering Template is more advanced than the original recovered state suggested.

### Key Findings

- MIA Liquibase/admin/viewer/backend work is broadly present, but likely has a data-contract mismatch between admin serialization and backend/viewer render expectations.
- Template/Plantilla work is not just Liquibase: backend DTOs/services/controllers and admin template components/specs already exist.
- The Template plan is stale because it says task type ID `7`, while actual implementation uses task type ID `15`.

### Next Start Point

- Start with `.sitmun-harness/state/next-actions.md`.
- First concrete task: audit and align MIA data contract between admin, viewer, and backend.

## 2026-05-06 - MIA Data Contract Alignment

### Actions Taken

- Backend now exposes `typeId` in `TaskDto`.
- Backend maps More Info Advanced task type `16` through `TaskMoreInfoService`.
- Backend exposes MIA client fields for type `16`: `advancedTaskKind`, `visualizationMode`, `childTaskOrderIds`, and `moreInfoAdvanced`.
- Admin MIA task type `16` no longer keeps its own UI relation; the viewer popup hook is a separate basic task using `sitna.moreInfoAdvanced`.
- Viewer MIA service now requires that basic control task hook before activating popups.
- Viewer MIA service indexes only type `16` parent MIA tasks and renders them through one backend request carrying all MIA task IDs.
- Backend MIA render now falls back from `includedTasks` to admin `childTaskOrderIds`, resolves child task parameter mappings, and renders child results in backend.
- Added focused tests for viewer request grouping/hook behavior, backend task mapping, and backend render fallback.

### Verification Run

- PASS: `front/viewer/sitmun-viewer-app`: `npm test -- --runInBand src/app/services/more-info-advanced.service.spec.ts`
- PASS: `back/backend/sitmun-backend-core`: `./gradlew --no-daemon --project-cache-dir /tmp/opencode/sitmun-backend-core-gradle-cache -PbuildDir=/tmp/opencode/sitmun-backend-core-build test --tests org.sitmun.authorization.client.dto.TaskMoreInfoServiceTest`
- PASS: `back/backend/sitmun-backend-core`: `./gradlew --no-daemon --project-cache-dir /tmp/opencode/sitmun-backend-core-gradle-cache -PbuildDir=/tmp/opencode/sitmun-backend-core-build test --tests org.sitmun.administration.service.template.TemplateExecutionServiceTest`
- PASS: `front/admin/sitmun-admin-app`: `npm test -- --runInBand src/app/components/tasks-basic/task-form/task-basic-form.component.spec.ts`

### Notes

- Normal backend Gradle cache/build directories are locked in this checkout, so backend verification used `/tmp/opencode` project cache and build dir.
- Next: broader builds, Liquibase validation, and security/authorization review.

## 2026-05-06 - Broader Verification And Reviews (Session 2)

### Actions Taken

- Ran broader builds: viewer build PASS, admin build PASS (only pre-existing budget warnings).
- Ran backend focused tests: TaskMoreInfoServiceTest + TemplateExecutionServiceTest both PASS.
- Ran Liquibase changelog validation: PASS (only expected master.xml diff to HEAD).
- Delegated security review to subagent — found P0 and P1 issues.
- Delegated Template plan reconciliation to subagent — found plan is stale but ~85% implemented.
- Updated all harness state files with findings.

### Security Review Findings

| Priority | Issue | Location |
|----------|-------|----------|
| P0 | innerHTML without sanitization | `more-info-advanced-control.handler.ts:380` |
| P0 | `/execute-child` uses `isAuthenticated()`, no task-level ACL | `TemplatePreviewController.java:28` |
| P1 | URL param injection (no URL-encoding) | `TemplateExecutionService.java:908-910` |

### Template Reconciliation Findings

- Plan is stale (says ID 7, actual is 15).
- ~85% of acceptance criteria met.
- Missing: standalone linked-task pre-validation service, seed data CSV verification, end-to-end Task 12.
- Risky: MIA + Template logic coupled in single TemplateExecutionService.

### Next Start Point

- Decision needed on P0-B fix approach (admin-only vs ACL vs accept risk).
- Then fix P0-A (DOMPurify), P0-B (chosen approach), P1 (URL-encode).
- After security fixes: run template admin specs, verify seed CSVs, commit all.

## 2026-05-06 - MIA Admin Rewrite + Security Fixes (Session 3)

### Actions Taken

1. **MIA admin form rewrite**: Completely rewrote `task-more-info-advanced-form.component.ts/html/scss` as a pure container form:
   - Removed parent/child concept, SQL/API/URL fields, HTML editor, separate tabs
   - Single "Información general" tab with: name, grupo tareas, cartografía, modo visualización
   - Inline "Tareas incluidas" table with order/up/down/delete
   - "Añadir tarea" autocomplete (filters to type 6 + 15 only)
   - Build: PASS

2. **i18n updates**: Replaced old MIA keys (38 keys) with new container-oriented keys (15 keys) across all 5 languages (es, en, ca, fr, oc-aranes). Kept `taskKind`/`kind.*` keys used by list component.

3. **Security fix P0-A**: Installed DOMPurify in viewer, added `DOMPurify.sanitize()` before innerHTML in `more-info-advanced-control.handler.ts:380`. Viewer build: PASS.

4. **Security fix P0-B**: Changed `/execute-child` from `@PreAuthorize("isAuthenticated()")` to `@PreAuthorize("hasRole('ADMIN')")` in `TemplatePreviewController.java`. Backend compile: PASS.

5. **Security fix P1**: Added `URLEncoder.encode(value, StandardCharsets.UTF_8)` in `TemplateExecutionService.resolveTemplateUrl()`. Backend tests: PASS.

6. **State files updated**: progress.md, mia-status.md, next-actions.md, session-log.md.

### Verification

- Admin build: PASS (no errors, only pre-existing warnings)
- Viewer build: PASS (webpack, no errors)
- Backend compile: PASS
- Backend TemplateExecutionServiceTest: PASS (2 tests)
- i18n key references: verified no dangling references

### Next Start Point

- Browser-verify MIA form rendering at localhost:4200
- Run template admin component specs
- Commit all submodules + stack

## 2026-05-06 - typeId Fix + MIA Popup Verified Working (Session 4)

### Context

- MIA popup was not appearing in viewer despite all builds passing.
- Debug logging in viewer showed ALL 40 tasks had `typeId: undefined`.
- MIA handler requires `typeId === 1` (for control task) and `typeId === 16` (for renderable tasks).

### Root Cause

- `TaskDto.typeId` has `@JsonInclude(NON_NULL)` — if null, excluded from JSON → viewer sees `undefined`.
- Only 2 out of 6 task mappers (`TaskBasicService`, `TaskMoreInfoService`) set `.typeId(...)` in their builder.
- The other 4 mappers (`TaskQueryWebService`, `TaskQueryCartographyService`, `TaskQuerySqlService`, `TaskEditCartographyService`) never set typeId.
- Additionally, the `.typeId(...)` lines in `TaskBasicService` and `TaskMoreInfoService` were uncommitted working-tree changes — the running Docker container used old code without them.

### Actions Taken

1. **Added `.typeId(task.getType() != null ? task.getType().getId() : null)` to all 4 remaining mappers.**
2. **Rebuilt backend Docker image** (`docker compose build backend && docker compose up -d backend`).
3. **User confirmed MIA popup now appears in the viewer.**
4. **Removed all debug `console.warn` logging** from `more-info-advanced.service.ts` and `more-info-advanced-control.handler.ts`.
5. **Verified viewer still compiles** after debug removal.
6. Updated harness state files.

### Verification

- Backend compile: PASS
- Backend tests: 834 pass, 8 fail (all 8 pre-existing — locale, codelist, proxy SQL — unrelated to typeId)
- Viewer build: PASS
- MIA popup: CONFIRMED WORKING by user in browser

### Key Insight

The MapStruct-generated `ProfileMapperImpl.java` correctly delegates `Task→TaskDto` to the custom `map(Task, @Context Application, @Context Territory)` method. The issue was never in MapStruct — it was simply that the concrete mappers weren't setting the field.

### Next Start Point

- Commit all submodules + stack-level changes (Priority 1)
- Run template admin component specs (Priority 2)
- Browser-verify MIA admin form at localhost:4200 (Priority 3)
