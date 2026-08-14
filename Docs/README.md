# Core-2 Documentation

This directory contains implementation plans, architecture decisions, and operational contracts for Core-2.

## Dispatch Backend V2

- [Execution plan](plans/DISPATCH_BACKEND_V2_EXECUTION_PLAN.md) — dependency-gated Phases 0–6, verification gates, rollback gates, and commit records.
- [Executor prompts](plans/DISPATCH_BACKEND_V2_EXECUTION_PROMPTS.md) — reusable prompts for Phases 1–6.
- [Domain contract ADR](architecture/ADR-DISPATCH-BACKEND-V2-DOMAIN-CONTRACT.md) — target state machines, capabilities, readiness, approval, attempt, and archive semantics.
- [Phase handoff checkpoint](plans/DISPATCH_BACKEND_V2_PHASE_HANDOFF.md) — durable execution state and exact verification results.

## Documentation status

The Dispatch Backend V2 documents define the accepted target contract. They do not claim that the V2 schema, commands, adapters, or lifecycle behavior are implemented. Until the execution plan records a completed phase, existing runtime behavior remains the compatibility baseline and must be treated as legacy where it conflicts with the target contract.
