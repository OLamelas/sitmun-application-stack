# Context Brief - Minimal Project Context

> Give this to every agent. It contains only what they need to know.

## What is SITMUN

Geospatial platform for territorial information management. 4 components:
- **Admin App** (Angular 19) - configuration interface
- **Viewer App** (Angular 19) - map visualization
- **Backend Core** (Spring Boot 3, Java 17) - REST API
- **Proxy Middleware** (Spring Boot 3, Java 17) - service proxy

## Repo structure

This is a **git submodule** orchestration repo. App code lives inside submodules:
- `front/admin/sitmun-admin-app`
- `front/viewer/sitmun-viewer-app`
- `back/backend/sitmun-backend-core`
- `back/proxy/sitmun-proxy-middleware`

Database migrations live directly in this repo under `profiles/*/liquibase/`.

## Task types

Tasks are configurable UI actions in the viewer. Each has a type ID and properties stored in `STM_TASK.TAS_PARAMS`. The system uses `STM_TASKREL` for relationships between tasks.

## Conventions

- Conventional commits: `feat(scope): description`, `fix(scope): description`
- TDD: tests before implementation
- Frontend: Jest for tests, Angular Material for UI
- Backend: JUnit 5, Spring patterns
- Liquibase: profile-specific changelogs, always include rollback
