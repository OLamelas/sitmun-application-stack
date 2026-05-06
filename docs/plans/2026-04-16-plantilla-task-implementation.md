# Plantilla Task Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new first-level `Plantilla` task that stores Handlebars HTML in `STM_TASK.TAS_PARAMS`, links query/template children through `STM_TASKREL`, allows manual execution/preview from the admin UI, and blocks linked API tasks with authentication.

**Architecture:** Reuse the existing task model (`STM_TASK` + `STM_TASKREL`) instead of adding new tables. Treat `Plantilla` as a real task type with catalog ID `7` (currently `report`/`informe` in development data and unused in prod profile CSVs), expose a dedicated admin list/form, add a reusable query-execution card component in admin, and add backend preview/execution endpoints that resolve linked tasks, execute them with manual input values, flatten results to `task_<id>.<field>` / `task_<id>.$<param>`, and render final HTML with Handlebars (max nesting depth 3).

**Tech Stack:** Angular 19 + Angular Material + Jest, Spring Boot 3 + Java 17 + JUnit 5, Liquibase CSV/YAML seed data, `STM_TASK.TAS_PARAMS` map storage, `STM_TASKREL`, WYSIWYG editor library for Angular 19, Java Handlebars library for backend template rendering.

---

### Task 1: Promote Task Type 7 To `Plantilla` In Seed Data And Frontend Constants

**Files:**
- Modify: `profiles/development/backend/liquibase/changelog/03_task_types/stm_tsk_typ.csv`
- Modify: `profiles/postgres/liquibase/changelog/03_task_types/STM_TSK_TYP.csv`
- Modify: `profiles/oracle/liquibase/changelog/03_task_types/STM_TSK_TYP.csv`
- Modify: `profiles/development/backend/liquibase/changelog/03_task_types/07_ReportDefinition.json`
- Modify: `front/admin/sitmun-admin-app/src/environments/constants.ts`
- Modify: `front/admin/sitmun-admin-app/src/config.ts`
- Modify: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/DomainConstants.java`

**Step 1: Write the failing backend/admin expectations down as tests first**

Create/update tests that assert task type `7` is now treated as template, not report:

- Add a backend unit test in a new file:
  - `back/backend/sitmun-backend-core/src/test/java/org/sitmun/domain/DomainConstantsTemplateTaskTest.java`
- Add an admin unit test in a new file:
  - `front/admin/sitmun-admin-app/src/app/components/tasks-template/tasks-template.component.spec.ts`

Example backend assertion:

```java
@Test
void templateTaskTypeIdIsSeven() {
  assertEquals(7, DomainConstants.Tasks.TASK_TYPE_ID_TEMPLATE);
}
```

**Step 2: Run the focused tests to verify they fail**

Run:

```bash
./gradlew test --tests org.sitmun.domain.DomainConstantsTemplateTaskTest
```

Run:

```bash
npm test -- --runInBand src/app/components/tasks-template/tasks-template.component.spec.ts
```

Expected: fail because template task constants/components do not exist yet.

**Step 3: Update seed data and constants minimally**

- In development CSV, rename row `7` from `informe,Report` to `template,Template`
- In postgres/oracle CSVs, add row `7,template,Template,true,,5` after `moreInfo`
- Replace `07_ReportDefinition.json` with a temporary minimal `Template` definition or keep the file path and change its contents/title to `Template`
- Add `taskTemplateTypeId: 7` to `magic`
- Rename/replace `config.tasksTypes.report` usage with `template: 7`
- Add `TASK_TYPE_ID_TEMPLATE = 7` to backend constants

**Step 4: Run the same focused tests again**

Expected: still partially failing until the new UI classes exist, but the backend constant test should pass.

**Step 5: Commit**

```bash
git add profiles/development/backend/liquibase/changelog/03_task_types/stm_tsk_typ.csv profiles/postgres/liquibase/changelog/03_task_types/STM_TSK_TYP.csv profiles/oracle/liquibase/changelog/03_task_types/STM_TSK_TYP.csv profiles/development/backend/liquibase/changelog/03_task_types/07_ReportDefinition.json front/admin/sitmun-admin-app/src/environments/constants.ts front/admin/sitmun-admin-app/src/config.ts back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/DomainConstants.java back/backend/sitmun-backend-core/src/test/java/org/sitmun/domain/DomainConstantsTemplateTaskTest.java
git commit -m "feat(template): add template task type catalog"
```

### Task 2: Extend Task Properties Contract For Template HTML And Preview Metadata

**Files:**
- Modify: `front/admin/sitmun-admin-app/src/app/domain/task/models/task-properties.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/domain/task/models/task-properties.builder.ts`
- Modify: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/DomainConstants.java`
- Test: `front/admin/sitmun-admin-app/src/app/domain/task/models/task-properties.spec.ts`

**Step 1: Write the failing frontend property-contract tests**

Add tests for:

- `templateHtml`
- `templateEditorState` (optional editor payload; preserve if present)

Example:

```ts
it('reads and writes templateHtml preserving unknown keys', () => {
  const next = TaskPropertiesContract.withTemplateHtml({ scope: 'sql-query' }, '<h1>{{task_12_nombre}}</h1>');
  expect(TaskPropertiesContract.getTemplateHtml(next)).toBe('<h1>{{task_12_nombre}}</h1>');
  expect(TaskPropertiesContract.getScope(next)).toBe('sql-query');
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --runInBand src/app/domain/task/models/task-properties.spec.ts
```

**Step 3: Implement minimal property support**

- Add keys `templateHtml` and `templateEditorState` in `TaskPropertiesContract`
- Add `getTemplateHtml`, `withTemplateHtml`, and raw-preserving editor state helpers
- Extend `TaskPropertiesBuilder` to read/write these keys while preserving existing query keys
- Mirror new property key constants in backend `DomainConstants.Tasks`

**Step 4: Run the test again**

Expected: pass.

**Step 5: Commit**

```bash
git add front/admin/sitmun-admin-app/src/app/domain/task/models/task-properties.ts front/admin/sitmun-admin-app/src/app/domain/task/models/task-properties.builder.ts front/admin/sitmun-admin-app/src/app/domain/task/models/task-properties.spec.ts back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/DomainConstants.java
git commit -m "feat(template): store template html in task properties"
```

### Task 3: Add Template Relations And Backend DTOs

**Files:**
- Modify: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/DomainConstants.java`
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/dto/TemplateLinkedTaskDto.java`
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/dto/TemplatePreviewRequestDto.java`
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/dto/TemplatePreviewResponseDto.java`
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/dto/TemplateTaskExecutionRequestDto.java`
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/dto/TemplateTaskExecutionResponseDto.java`
- Test: `back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/controller/dto/TemplatePreviewDtoTest.java`

**Step 1: Write failing DTO/constant tests**

Add tests asserting the new relation names and DTO serialization assumptions exist:

- `RELATION_TYPE_TEMPLATE_TASK = "template-task"`
- `RELATION_TYPE_TEMPLATE_NESTED = "template-nested"`

**Step 2: Run the tests to verify failure**

```bash
./gradlew test --tests org.sitmun.administration.controller.dto.TemplatePreviewDtoTest
```

**Step 3: Implement the constants and DTOs**

Rules encoded in DTOs:

- linked tasks table returns `id`, `name`, `scope`, `linkedType`, `hasAuthentication`
- execution response returns:
  - `taskId`
  - `status`
  - `parameters`
  - `resultType`
  - `rows` or `resourceUrl`
  - `flattenedContextKeys`

**Step 4: Run DTO test again**

Expected: pass.

**Step 5: Commit**

```bash
git add back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/DomainConstants.java back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/dto back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/controller/dto/TemplatePreviewDtoTest.java
git commit -m "feat(template): add preview dto contract"
```

### Task 4: Add Backend Service To Resolve And Validate Linked Tasks

**Files:**
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/service/template/TemplateLinkedTaskService.java`
- Modify: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/task/TaskRepository.java`
- Test: `back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/service/template/TemplateLinkedTaskServiceTest.java`

**Step 1: Write failing service tests**

Cover:

- list linked children from `STM_TASKREL`
- allow child query scopes `sql-query`, `web-api-query`, `URL`, `resource`
- allow nested child task type `template`
- reject cartography query children
- reject web API children when `authenticationMode != null` and not `None`
- enforce max template nesting depth `3`

**Step 2: Run focused test and verify failure**

```bash
./gradlew test --tests org.sitmun.administration.service.template.TemplateLinkedTaskServiceTest
```

**Step 3: Implement minimal service and repository helpers**

- Add repository query or service logic to load `relations` and `relatedTask`
- Classify task kind from `type.id` + `properties.scope`
- Use `STM_TASKREL` only; never use `TAS_PARAMS` for links
- For API children, read `properties.authenticationMode`; if set to non-empty/non-`None`, mark invalid for linking

**Step 4: Run focused test again**

Expected: pass.

**Step 5: Commit**

```bash
git add back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/service/template/TemplateLinkedTaskService.java back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain/task/TaskRepository.java back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/service/template/TemplateLinkedTaskServiceTest.java
git commit -m "feat(template): validate linked template children"
```

### Task 5: Add Reusable Backend Query Execution For Admin Preview

**Files:**
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/service/template/AdminTaskExecutionService.java`
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/TemplatePreviewController.java`
- Modify: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/authorization/proxy/service/ProxyConfigurationService.java`
- Test: `back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/service/template/AdminTaskExecutionServiceTest.java`
- Test: `back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/controller/TemplatePreviewControllerTest.java`

**Step 1: Write failing backend execution tests**

Cover one test per scope:

- SQL task returns flattened tabular rows
- Web API task returns flattened JSON fields
- URL task returns `{ "url": resolvedUrl }`
- Resource task returns `{ "url": resolvedUrl }`
- nested template returns `{ "html": renderedHtml }`

Parameter rules:

- manual values only
- expose parameter placeholders as `task_<id>.$<variable>`
- expose response fields as `task_<id>.<field>`

**Step 2: Run focused tests to verify failure**

```bash
./gradlew test --tests org.sitmun.administration.service.template.AdminTaskExecutionServiceTest --tests org.sitmun.administration.controller.TemplatePreviewControllerTest
```

**Step 3: Implement minimal execution pipeline**

- Reuse existing task/proxy configuration logic where possible
- For SQL/API: execute through existing proxy/config path using manual parameters
- For URL/Resource: resolve URL only, do not fetch binary payload for admin preview
- Flatten first-row object fields and primitive result keys into `task_<id>_<field>`
- Flatten submitted parameter values into `task_<id>_$<param>`

Expose endpoints:

- `POST /api/tasks/template/execute-child`
- `POST /api/tasks/template/preview`

**Step 4: Run focused tests again**

Expected: pass.

**Step 5: Commit**

```bash
git add back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/service/template back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/controller/TemplatePreviewController.java back/backend/sitmun-backend-core/src/main/java/org/sitmun/authorization/proxy/service/ProxyConfigurationService.java back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/service/template/AdminTaskExecutionServiceTest.java back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/controller/TemplatePreviewControllerTest.java
git commit -m "feat(template): add admin child execution and preview endpoints"
```

### Task 6: Add Java Handlebars Rendering With Depth Limit 3

**Files:**
- Modify: `back/backend/sitmun-backend-core/build.gradle`
- Modify: `back/backend/sitmun-backend-core/gradle/libs.versions.toml`
- Create: `back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/service/template/TemplateRenderService.java`
- Test: `back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/service/template/TemplateRenderServiceTest.java`

**Step 1: Write failing render-service tests**

Cover:

- render `{{task_13.nombre}}`
- render `{{task_13.$param1}}`
- render nested template html with `{{task_16.html}}`
- reject depth > 3
- leave preview errors explicit when placeholder missing

**Step 2: Run focused tests to verify failure**

```bash
./gradlew test --tests org.sitmun.administration.service.template.TemplateRenderServiceTest
```

**Step 3: Add Handlebars dependency and minimal renderer**

- Add Java Handlebars dependency through version catalog and `build.gradle`
- Compile raw HTML from `TAS_PARAMS.templateHtml`
- Render with flat context map only
- Never use dotted notation in user docs; support only flattened keys the user requested

**Step 4: Run focused test again**

Expected: pass.

**Step 5: Commit**

```bash
git add back/backend/sitmun-backend-core/build.gradle back/backend/sitmun-backend-core/gradle/libs.versions.toml back/backend/sitmun-backend-core/src/main/java/org/sitmun/administration/service/template/TemplateRenderService.java back/backend/sitmun-backend-core/src/test/java/org/sitmun/administration/service/template/TemplateRenderServiceTest.java
git commit -m "feat(template): render template html with handlebars"
```

### Task 7: Add Admin List, Route, And Form Shell For `Plantilla`

**Files:**
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/tasks-template.component.ts`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/tasks-template.component.html`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/tasks-template.component.spec.ts`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.ts`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.html`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.scss`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.spec.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/core/config/configuration.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/app-routes.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/components/shared/side-menu/side-menu.component.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/services/icons.service.ts`
- Modify: `front/admin/sitmun-admin-app/src/environments/constants.ts`

**Step 1: Write failing component/route tests**

Add tests for:

- menu includes `Plantilla` after `Consulta`
- `tasksTemplate` route exists
- form initializes with task type `7`

**Step 2: Run focused tests and verify failure**

```bash
npm test -- --runInBand src/app/components/tasks-template/tasks-template.component.spec.ts src/app/components/tasks-template/task-form/task-template-form.component.spec.ts
```

**Step 3: Implement minimal shell**

- Follow `TasksQueryComponent` + `TaskMoreInfoFormComponent` patterns
- Use label keys under `entity.task.report.*` only if convenient, but rename displayed copy to `Plantilla`
- Query only tasks with `type.id = 7`

**Step 4: Run focused tests again**

Expected: pass.

**Step 5: Commit**

```bash
git add front/admin/sitmun-admin-app/src/app/components/tasks-template front/admin/sitmun-admin-app/src/app/core/config/configuration.ts front/admin/sitmun-admin-app/src/app/app-routes.ts front/admin/sitmun-admin-app/src/app/components/shared/side-menu/side-menu.component.ts front/admin/sitmun-admin-app/src/app/services/icons.service.ts front/admin/sitmun-admin-app/src/environments/constants.ts
git commit -m "feat(template): add admin list and form shell"
```

### Task 8: Add Reusable Query Execution Card Component For Admin

**Files:**
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/query-execution-card/query-execution-card.component.ts`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/query-execution-card/query-execution-card.component.html`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/query-execution-card/query-execution-card.component.scss`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/query-execution-card/query-execution-card.component.spec.ts`
- Create: `front/admin/sitmun-admin-app/src/app/domain/task/services/task-template-preview.service.ts`

**Step 1: Write failing component tests**

Cover:

- renders task header with type/name/id/status
- renders one input per parameter
- clicking `Ejecutar` flips status `Pendiente -> Ejecutando -> Completado`
- SQL/API response renders as table rows
- URL/Resource response exposes `.url`
- nested template card shows `Ejecutar plantilla`

**Step 2: Run focused tests to verify failure**

```bash
npm test -- --runInBand src/app/components/tasks-template/query-execution-card/query-execution-card.component.spec.ts
```

**Step 3: Implement the minimal reusable component**

- Inputs:
  - linked task metadata
  - manual parameters
  - nested level
- Outputs:
  - execution state/result change events
- Keep it generic enough to reuse later inside `tasks-query` form

**Step 4: Run focused tests again**

Expected: pass.

**Step 5: Commit**

```bash
git add front/admin/sitmun-admin-app/src/app/components/tasks-template/query-execution-card front/admin/sitmun-admin-app/src/app/domain/task/services/task-template-preview.service.ts
git commit -m "feat(template): add reusable query execution card"
```

### Task 9: Implement Linked-Tasks Table And Relation Persistence In Template Form

**Files:**
- Modify: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.html`
- Modify: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.scss`
- Modify: `front/admin/sitmun-admin-app/src/app/domain/task/services/task-relation.service.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/domain/task/index.ts`
- Test: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.spec.ts`

**Step 1: Write failing form tests**

Cover:

- linked tasks table shows `Name`, `Type`, trash column
- name format is `{tas_name} (ID: {tas_id})`
- trash click opens confirmation dialog and deletes only relation
- linking filters out cartography queries
- linking blocks authenticated API tasks with warning
- allows nested template up to level 3

**Step 2: Run focused tests and verify failure**

```bash
npm test -- --runInBand src/app/components/tasks-template/task-form/task-template-form.component.spec.ts
```

**Step 3: Implement relation-backed UI**

- Load current child relations from `task-relations`
- Persist query child links with `template-task`
- Persist nested template links with `template-nested`
- Delete only the selected relation after confirm dialog (`DialogMessageComponent`)
- Build two candidate sets:
  - query children: query tasks excluding cartography and authenticated API tasks
  - nested template children: template tasks excluding self and depth > 3

**Step 4: Run focused tests again**

Expected: pass.

**Step 5: Commit**

```bash
git add front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.ts front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.html front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.scss front/admin/sitmun-admin-app/src/app/domain/task/services/task-relation.service.ts front/admin/sitmun-admin-app/src/app/domain/task/index.ts front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.spec.ts
git commit -m "feat(template): manage linked template child relations"
```

### Task 10: Add WYSIWYG HTML Editor And Notes

**Files:**
- Modify: `front/admin/sitmun-admin-app/package.json`
- Modify: `front/admin/sitmun-admin-app/package-lock.json`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/template-editor/template-editor.component.ts`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/template-editor/template-editor.component.html`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/template-editor/template-editor.component.scss`
- Create: `front/admin/sitmun-admin-app/src/app/components/tasks-template/template-editor/template-editor.component.spec.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.html`
- Modify: `front/admin/sitmun-admin-app/src/assets/i18n/es.json`
- Modify: `front/admin/sitmun-admin-app/src/assets/i18n/ca.json`
- Modify: `front/admin/sitmun-admin-app/src/assets/i18n/en.json`
- Modify: `front/admin/sitmun-admin-app/src/assets/i18n/fr.json`
- Modify: `front/admin/sitmun-admin-app/src/assets/i18n/oc-aranes.json`

**Step 1: Write failing editor tests**

Cover:

- editor binds to `templateHtml`
- displays blue backend variable info box using `{{#VARIABLE}}`
- displays usage note for:
  - response fields `{{task_13.nombre}}`
  - task params `{{task_13.$param1}}`
  - URL/resource URL `{{task_12.url}}`
  - nested template html `{{task_16.html}}`

**Step 2: Run focused tests to verify failure**

```bash
npm test -- --runInBand src/app/components/tasks-template/template-editor/template-editor.component.spec.ts
```

**Step 3: Install and wire the WYSIWYG**

- Add one Angular-19-compatible editor dependency (recommended: `ngx-quill` + `quill`)
- Wrap it in `template-editor.component`
- Save HTML output to `templateHtml`
- Keep the explanatory notes under the editor exactly as clarified by the user

**Step 4: Run focused tests again**

Expected: pass.

**Step 5: Commit**

```bash
git add front/admin/sitmun-admin-app/package.json front/admin/sitmun-admin-app/package-lock.json front/admin/sitmun-admin-app/src/app/components/tasks-template/template-editor front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.html front/admin/sitmun-admin-app/src/assets/i18n/es.json front/admin/sitmun-admin-app/src/assets/i18n/ca.json front/admin/sitmun-admin-app/src/assets/i18n/en.json front/admin/sitmun-admin-app/src/assets/i18n/fr.json front/admin/sitmun-admin-app/src/assets/i18n/oc-aranes.json
git commit -m "feat(template): add wysiwyg template editor"
```

### Task 11: Wire Preview Pane To Executions And Render Endpoint

**Files:**
- Modify: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.ts`
- Modify: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.html`
- Test: `front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.spec.ts`

**Step 1: Write failing form-preview tests**

Cover:

- preview pane lists detected placeholders before rendering
- render button calls backend preview endpoint
- rendered HTML is shown in the right pane
- status chips update independently per child card

**Step 2: Run focused tests to verify failure**

```bash
npm test -- --runInBand src/app/components/tasks-template/task-form/task-template-form.component.spec.ts
```

**Step 3: Implement minimal preview flow**

- Collect executed child results from reusable cards
- Post current `templateHtml` + collected contexts to backend preview endpoint
- Render response safely in preview iframe/container
- Use regex-based placeholder detection in admin for the empty-state helper list

**Step 4: Run focused tests again**

Expected: pass.

**Step 5: Commit**

```bash
git add front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.ts front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.html front/admin/sitmun-admin-app/src/app/components/tasks-template/task-form/task-template-form.component.spec.ts
git commit -m "feat(template): render template preview from executed children"
```

### Task 12: Full Verification

**Files:**
- No new files

**Step 1: Run focused admin tests**

```bash
npm test -- --runInBand src/app/components/tasks-template src/app/domain/task/models/task-properties.spec.ts src/app/components/tasks-query/task-form/task-query-form.component.spec.ts
```

Expected: all selected admin tests pass.

**Step 2: Run focused backend tests**

```bash
./gradlew test --tests org.sitmun.domain.DomainConstantsTemplateTaskTest --tests org.sitmun.administration.service.template.TemplateLinkedTaskServiceTest --tests org.sitmun.administration.service.template.AdminTaskExecutionServiceTest --tests org.sitmun.administration.service.template.TemplateRenderServiceTest --tests org.sitmun.administration.controller.TemplatePreviewControllerTest
```

Expected: all selected backend tests pass.

**Step 3: Run admin build**

```bash
npm run build
```

Expected: Angular build succeeds with the new editor dependency.

**Step 4: Run backend test suite slice or compile if needed**

```bash
./gradlew compileJava testClasses
```

Expected: backend compiles cleanly.

**Step 5: Verify root repo status for profile seed changes**

```bash
git status --short
```

Expected: only intended root/profile changes plus submodule pointer changes.

**Step 6: Final integration commit(s)**

Create commits only if explicitly requested by the user, one per affected repo:

- stack repo for Liquibase/profile data
- `sitmun-admin-app`
- `sitmun-backend-core`

---

## Notes For Execution

- Keep `Plantilla` storage in `STM_TASK.TAS_PARAMS.templateHtml`
- Keep linked child persistence in `STM_TASKREL`
- Child placeholders required by the user are dotted:
  - response field: `{{task_13.nombre}}`
  - task param: `{{task_13.$param1}}`
  - URL/resource: `{{task_12.url}}`
  - nested template HTML: `{{task_16.html}}`
- Block linked `web-api-query` tasks if authentication is enabled
- `resource` tasks are linkable and expose only `.url`
- `URL` tasks are linkable and expose only `.url`
- Nesting limit is exactly `3`
