# Core-2 Documentation Index

This directory contains implementation documentation, feature catalogs, module architecture, design specifications, and operational runbooks for Core Transaction 2.

## System Documentation
- [Feature Catalog](features.md) — Comprehensive functional catalog across Dispatch Intake, Scheduling, Approvals, Tracking, Shared Surfaces, and Native Field Mobile.
- [Module Architecture](modules.md) — Backend domain modules, Web React/Inertia architecture, and React Native field mobile structure.

## Dispatch Domain & Backend V2
- [Domain Contract ADR](architecture/ADR-DISPATCH-BACKEND-V2-DOMAIN-CONTRACT.md) — Target state machines, capabilities, readiness, approval, attempt, and archive semantics.
- [Execution Plan](plans/DISPATCH_BACKEND_V2_EXECUTION_PLAN.md) — Dependency-gated Phases 0–6, verification gates, rollback gates, and commit records.
- [Phase Handoff Checkpoint](plans/DISPATCH_BACKEND_V2_PHASE_HANDOFF.md) — Durable execution state and exact verification results for backend phases.
- [Executor Prompts](plans/DISPATCH_BACKEND_V2_EXECUTION_PROMPTS.md) — Reusable prompts for backend phases.
- [Legacy Mapping](plans/DISPATCH_BACKEND_V2_PHASE_1_LEGACY_MAPPING.md) — Phase 1 legacy field and schema mappings.

## AI Quality Verification & UI Execution Reports
- [AI Quality Verification Answers](../.ai-reports/ai-verification-questions.md) — Rigorous responses to the 4 mandatory AI verification questions across all phases.
- [Final UI Execution Report](../.ai-reports/ui-execution/FINAL-EXECUTION-REPORT.md) — Complete execution history, test matrices, and release readiness for UI phases UI-0 through UI-7.
