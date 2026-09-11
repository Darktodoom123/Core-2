# Development & Prototype Fixtures (DEV ONLY)

> **ARCHITECTURAL BOUNDARY WARNING**
>
> This directory contains **mock fixture datasets** used exclusively for:
>
> 1. Unrouted prototype / sandbox simulations (`resources/js/pages/operations.tsx`)
> 2. Isolated UI component mockup testing
>
> ### STRICT BOUNDARY RULES
>
> - **NEVER IMPORT INTO PRODUCTION WORKSPACES**: Live operational pages (`/operations`, `resources/js/pages/workspace.tsx`, `resources/js/pages/dispatch-detail.tsx`, `resources/js/components/workspace/*`) must **NEVER** import or reference these fixtures.
> - **SERVER-AUTHORITATIVE**: All live workspace state is strictly provided by Laravel Inertia view models (`OperationsWorkspaceViewModel`, `DispatchDetailPageProps`) and dedicated REST endpoints.
> - **MUTATION PROHIBITED**: Fixtures represent static demo records and must not be used as local mutable mock-stores.
