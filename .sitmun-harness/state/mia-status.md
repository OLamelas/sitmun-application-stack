# MIA (More Info Advanced) - Status

## Overview

New task type "More Info Advanced" (TTY_ID=16) that acts as a **container** grouping child query tasks (type 6 and type 15). It never has its own query, SQL, or API configuration.

## What's done

### Liquibase migrations (stack repo) - DONE
- [x] `43_add_more_info_advanced_ui_control.yaml` - adds UI control `sitna.moreInfoAdvanced` to STM_TSK_UI
- [x] `44_add_more_info_advanced_task_type.yaml` - adds task type 16 to STM_TSK_TYP with JSON spec
- [x] `master.xml` updated in all 3 profiles (development, postgres, oracle) to include changelogs 43 and 44

### Admin frontend (sitmun-admin-app) - DONE
- [x] `tasks-more-info-advanced/tasks-more-info-advanced.component.ts` - list component
- [x] `tasks-more-info-advanced/tasks-more-info-advanced.component.html` - list template
- [x] `tasks-more-info-advanced/task-form/task-more-info-advanced-form.component.ts` - form (rewritten as pure container: name, group, cartography, display mode, inline included-tasks table)
- [x] `tasks-more-info-advanced/task-form/task-more-info-advanced-form.component.html` - form template (single tab, inline task list with order/arrows/delete + autocomplete add)
- [x] `tasks-more-info-advanced/task-form/task-more-info-advanced-form.component.scss` - clean table styles
- [x] Routes updated (`app-routes.ts`)
- [x] Side menu updated (`side-menu.component.ts`)
- [x] Constants updated (`constants.ts`)
- [x] Configuration updated (`configuration.ts`)
- [x] i18n files updated (es, en, ca, fr, oc-aranes) with new container-oriented labels
- [x] Existing `tasks-more-info` component modified to support differentiation
- [x] `task-basic-form.component.ts` and spec modified
- [x] `data-grid.component` (frontend-gui lib) modified
- Build: PASS

### Viewer frontend (sitmun-viewer-app) - DONE
- [x] `more-info-advanced-control.handler.ts` - control handler with DOMPurify sanitization
- [x] `more-info-advanced.service.ts` - service
- [x] Existing handlers modified (`feature-info-control.handler.ts`, `index.ts`)
- [x] `control-registry.service.ts` modified
- [x] `main.scss` modified
- [x] DOMPurify added as dependency for HTML sanitization (P0-A fix)
- Build: PASS

### Backend (sitmun-backend-core) - DONE
- [x] `MoreInfoAdvancedRenderRequestDto.java` - DTO
- [x] `MoreInfoAdvancedRenderResponseDto.java` - DTO
- [x] `MoreInfoAdvancedRenderedTaskDto.java` - DTO
- [x] `TemplatePreviewController` - `/more-info-advanced/render` (isAuthenticated), `/execute-child` (hasRole ADMIN), `/preview` (hasRole ADMIN)
- [x] `AdminTaskExecutionService` delegates MIA rendering to `TemplateExecutionService`
- [x] `TemplateExecutionService` renders MIA children, URL-encodes parameters (P1 fix)
- [x] Tests: PASS (TaskMoreInfoServiceTest, TemplateExecutionServiceTest)
- Compile: PASS

## Security fixes applied (2026-05-06 session 3)

| Issue | Fix | Status |
|-------|-----|--------|
| P0-A: innerHTML XSS | Added DOMPurify.sanitize() before innerHTML in viewer handler | DONE |
| P0-B: /execute-child too broad | Changed to `@PreAuthorize("hasRole('ADMIN')")` | DONE |
| P1: URL param injection | Added URLEncoder.encode() in resolveTemplateUrl | DONE |

## MIA admin form design (2026-05-06 session 3 rewrite)

The form now matches the reference screenshot as a **pure container** with:
- **Nombre tarea** (text input, required)
- **Grupo de tareas** (dropdown from TaskGroupService)
- **Cartografia utilizada** (autocomplete from CartographyService)
- **Modo de visualizacion** (dropdown: Scroll/Pestanas)
- **Tareas incluidas** (inline table: Orden | Nombre (ID) | Tipo | up/down/delete actions)
- **Anadir tarea** (autocomplete selecting from type 6 + type 15 tasks only)
- **Parameters hint** (italic note that params come from child tasks)

NO parent/child concept. NO SQL/API/URL fields. NO HTML editor. NO separate tabs.

## What's pending

1. Browser manual verification of form rendering at localhost:4200
2. Commit all changes (submodules + stack)
3. Update submodule pointers

## Current git state

- All files above are uncommitted in submodules
- Liquibase files are uncommitted in stack repo
- Submodule pointers need to be updated after commits
