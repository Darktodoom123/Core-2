# Core Transaction 2 — Consolidated Deliverables

**Last updated:** 2026-07-31  
**Status:** Maintained review, submission, and download package

These five standalone documents summarize the accepted Core Transaction 2
product direction and current implementation boundary. Detailed documents
indexed by [Docs/README.md](../README.md) remain authoritative when a summary
omits detail.

## Maintained deliverables

1. [Product Requirements Document](./01_PRD_Core_Transaction_2.md)
2. [User Story Map](./02_User_Story_Map.md)
3. [Sprint Plan](./03_Sprint_Plan.md)
4. [Technical Architecture](./04_Technical_Architecture.md)
5. [Design System Specification](./05_Design_System_Specification.md)

## Authority

Use the following order when sources disagree:

1. Laravel migrations, application code, and configuration define current
   implementation.
2. Passing tests provide acceptance evidence.
3. Accepted decisions and detailed product documents in `Docs/` define intent,
   boundaries, rules, and planned evolution.
4. The files above summarize those sources for standalone review.
5. Supplemental proposals are non-canonical recommendation sources.

Capability status must remain explicit: live backend/UI, partial, prototype,
planned, deferred, or rejected. A consolidated summary does not promote
prototype or proposed behavior to live behavior.

## Supplemental recommendation sources

The [supplemental source library](./supplements/README.md) preserves proposal
material without overwriting the maintained deliverables.

- [2026-07-27 proposal set](./supplements/2026-07-27-proposal/README.md)
- [Recommendation register](./supplements/RECOMMENDATION_REGISTER.md)
- [Source crosswalk](./supplements/SOURCE_CROSSWALK.md)
- [Integration plan](../plans/CT2_SUPPLEMENTAL_SOURCE_INTEGRATION_PLAN.md)

Read the supplement notice and register disposition before reusing a proposal.
Accepted ideas must be promoted into their canonical owner document before
implementation or delivery planning.

