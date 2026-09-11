# Core-2 documentation

Core-2 is organized as a two-service monorepo:
- `apps/operations/`: Operations monolith, Inertia 3 + React 19 web frontend, and dedicated queue workers (`ai`, `reports`, `default`).
- `apps/tracking/`: Standalone Tracking microservice with dedicated database (`core2_ms_tracking`) and HMAC-signed telemetry REST API.
- `packages/field-mobile/`: Native Expo React Native field mobile client.
- Active mobile location sharing targets 15-second foreground captures and native background updates. Background delivery remains subject to OS scheduling and connectivity; this is not a guaranteed end-to-end latency. Restart sharing after loading an updated mobile bundle to refresh the native registration.
- `infra/docker/`: Container definitions, multi-stage Dockerfiles, Nginx configs, and Supervisor process topologies.

## Microservice architecture and progress

Start with the [architecture documentation](microservice/architecture.md), then inspect [progress checkpoints](microservice/progress.md).
- [Docker operations](architecture/docker.md) describes the container and worker supervision topology.
- [Deployment and hosting](architecture/deployment.md) records the HostForge topology and release verification evidence.

Other local product/design/reference documents may remain Git-ignored. The microservice folder is deliberately trackable so the implementation handoff survives a new checkout.
