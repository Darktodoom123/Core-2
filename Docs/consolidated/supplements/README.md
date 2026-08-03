# CT2 Supplemental Source Library

**Last updated:** 2026-07-31  
**Status:** Non-canonical reference library

This directory preserves proposal material that can inform Core Transaction 2
(CT2) product review without replacing accepted decisions, maintained
documentation, or current implementation evidence.

## Read this first

Supplemental documents are recommendation sources only. They may contain
obsolete delivery assumptions, alternative architectures, non-canonical state
names, unvalidated targets, and visual directions that the project has already
superseded.

Use the following authority order:

1. Laravel migrations, application code, and configuration define implemented
   behavior.
2. Passing tests provide acceptance evidence.
3. Accepted decisions in [Phase 0 baseline](../../phase-0-baseline.md) and
   [Top-level modules](../../modules.md) govern binding product and architecture
   choices.
4. Detailed documents indexed by [Docs/README.md](../../README.md) define
   accepted intent and planned evolution.
5. The five files in the parent [consolidated package](../README.md) are
   maintained standalone summaries.
6. The [recommendation register](./RECOMMENDATION_REGISTER.md) records review
   decisions about supplemental ideas.
7. Proposal files in this library are non-binding source material.

## Source sets

| Source set | Status | Import mode | Purpose |
| --- | --- | --- | --- |
| [2026-07-27 proposal](./2026-07-27-proposal/README.md) | Draft source set | Normalized reference edition | Preserve the supplied PRD, story map, sprint, architecture, and design proposals for traceability and recommendation review |
| [Capstone Requirements Questionnaire](./capstone-requirements-questionnaire.md) | Empirical field survey | Transcribed & normalized | Empirical requirements baseline gathered from operational personnel at Bestlink College of the Philippines |

## Review artifacts

- [Recommendation register](./RECOMMENDATION_REGISTER.md) — dispositions,
  rationale, owners, and promotion targets
- [Source crosswalk](./SOURCE_CROSSWALK.md) — source-to-canonical mapping and
  conflict summary
- [Integration plan](../../plans/CT2_SUPPLEMENTAL_SOURCE_INTEGRATION_PLAN.md) —
  governance, phases, validation, and definition of done

## Promotion rule

A proposal becomes product scope only after it is:

1. recorded in the recommendation register;
2. reviewed against accepted decisions and current evidence;
3. marked `accepted` or `accepted with changes`;
4. added to the narrowest canonical owner document;
5. reflected in dependent summaries and delivery plans; and
6. implemented and verified before its maturity is described as live.

The register is a decision record, not a second backlog. Delivery work is
created only for accepted scope.

## Import policy

- Date-version every source set.
- Preserve original identifiers as source references.
- State whether each imported file is verbatim, annotated, or normalized.
- Never claim a normalized file has a verbatim source hash.
- Keep external claims, technology choices, estimates, and compliance targets
  non-binding until reviewed.
- Do not overwrite the maintained consolidated deliverables with a source file
  that happens to use the same filename.

