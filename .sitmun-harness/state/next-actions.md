# Next Actions

## Priority 1 - Commit And Submodule Pointer Update

All fixes verified and working. Ready to commit:
1. Commit backend changes in sitmun-backend-core submodule (typeId in all mappers, MIA service, etc.)
2. Commit viewer changes in sitmun-viewer-app submodule (MIA handler + service, debug logging removed)
3. Commit admin changes in sitmun-admin-app submodule (MIA admin form, i18n)
4. Commit stack-level .sitmun-harness/ + submodule pointer updates
5. Note: backend has pre-existing `.factorypath`; do not include in commits

## Priority 2 - Template Remaining Gaps

Template is ~85% implemented. Remaining gaps:
1. No standalone linked-task pre-validation (plan's TemplateLinkedTaskService)
2. Seed data CSVs unverified for task type 15
3. Admin template component specs not run in this session
4. Plan's end-to-end verification (Task 12) not done

## Priority 3 - MIA Admin Form Browser Verification

MIA admin form has been rewritten and all builds pass. Verify at localhost:4200:
1. Navigate to "Tareas de más información avanzada" in side menu
2. Create new task or edit existing one
3. Confirm form shows: name, grupo tareas, cartografía, modo visualización, inline included-tasks table
4. Test adding a task via autocomplete
5. Test reordering with arrows and deleting
