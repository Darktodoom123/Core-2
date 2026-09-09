# Core-2 documentation

Core-2 is currently an undeployed Laravel modular monolith with Inertia web and Expo mobile clients.

## Microservice restructuring

Start with the [complete implementation handoff](microservice/README.md), then read the [target architecture](microservice/architecture.md) and [progress checkpoint](microservice/progress.md). The handoff contains phases 0 through 8, from preserving the baseline through the first authorized deployment.

This package supersedes the earlier live-production migration assumptions. Existing development data is preserved; new service databases use isolated synthetic fixtures. Application extraction has not started.

## Existing runtime documentation

- [Docker operations](architecture/docker.md) describes the current single-application image.
- [Deployment and hosting](architecture/deployment.md) records the proposed HostForge topology and evidence still required before deployment.

Other local product/design/reference documents may remain Git-ignored. The microservice folder is deliberately trackable so the implementation handoff survives a new checkout.
