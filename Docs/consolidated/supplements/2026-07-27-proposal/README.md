# CT2 Proposal Set — 2026-07-27

**Document class:** Supplemental source set  
**Source date:** 2026-07-27  
**Imported:** 2026-07-30  
**Authority:** Non-canonical  
**Use:** Recommendation and traceability source only  
**Supersession rule:** Accepted `Docs/` decisions and current implementation
prevail  
**Review register:** [Recommendation register](../RECOMMENDATION_REGISTER.md)

## Provenance

The five source documents were supplied by the user in the planning session
that produced the
[supplemental-source integration plan](../../../plans/CT2_SUPPLEMENTAL_SOURCE_INTEGRATION_PLAN.md).
They described a broad greenfield CT2 concept and used filenames that already
belong to the maintained consolidated package.

To prevent collision and accidental promotion, this directory contains
**normalized reference editions**. They preserve source metadata, identifiers,
proposal families, targets, assumptions, and conflicts in a reviewable form;
they are not represented as byte-for-byte copies. Verbatim source hashes are
therefore not applicable.

## Files

| File | Original status | Primary use |
| --- | --- | --- |
| [Product requirements proposal](./01_PRD_Core_Transaction_2.md) | Draft for stakeholder review | Personas, feature inventory, KPI, integration, risk, and non-functional recommendations |
| [User story map proposal](./02_User_Story_Map.md) | Living story map | Source story identifiers, task coverage, acceptance ideas, and release assumptions |
| [Sprint plan proposal](./03_Sprint_Plan.md) | Living greenfield plan | Dependency, quality-gate, and post-MVP theme recommendations |
| [Technical architecture proposal](./04_Technical_Architecture.md) | Draft for engineering review | Alternative stack/topology, domain, data, observability, and performance options |
| [Design system proposal](./05_Design_System_Specification.md) | Draft for design review | Component anatomy, state coverage, accessibility, and alternative visual tokens |

## Known source assumptions

The set assumes:

- a greenfield, approximately 20-week delivery;
- an eight-developer team and uncalibrated 35–40 point velocity;
- React/TypeScript web, React Native/Expo mobile, and a Node.js/NestJS/Prisma
  backend;
- JWT browser authentication and a REST/GraphQL/API-gateway boundary;
- Redis, Elasticsearch, TimescaleDB, Kubernetes, and AWS-oriented
  infrastructure;
- blue as the primary color and Inter as the product typeface;
- an eleven-stage dispatch presentation;
- 99.9% availability, 500 simultaneous dispatchers, and two-year GPS
  retention.

Several assumptions conflict with accepted CT2 decisions. See the
[source crosswalk](../SOURCE_CROSSWALK.md) before reusing any proposal.

## Canonical references

- [Documentation index](../../../README.md)
- [Top-level modules](../../../modules.md)
- [Phase 0 baseline](../../../phase-0-baseline.md)
- [Feature catalog](../../../features.md)
- [Architecture](../../../Architecture.md)
- [Product design](../../../Design.md)
- [Roadmap](../../../Roadmap.md)

