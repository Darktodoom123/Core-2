# CT2 Supplemental Source Integration Plan

**Status:** Documentation foundation implemented; stakeholder recommendation
review remains  
**Prepared:** 2026-07-29  
**Implemented:** 2026-07-30  
**Scope:** The five 2026-07-27 CT2 proposal documents supplied for use as
supplements and recommendation sources  
**Execution mode:** Documentation-first; no product, architecture, sprint, or
design decision becomes accepted merely because it appears in a supplement

## 1. Objective

Preserve the supplied PRD, user story map, sprint plan, technical architecture,
and design system as useful source material without allowing their greenfield
assumptions to overwrite the accepted Laravel-era product direction or the
current implementation record.

The integration must produce four outcomes:

1. The supplied documents remain available as clearly labelled source
   artifacts.
2. Reviewers can distinguish canonical facts, current implementation evidence,
   supplemental proposals, and rejected or deferred ideas.
3. Useful recommendations can be traced from their source paragraph to an
   explicit disposition and, when accepted, to a canonical document and
   delivery item.
4. The five maintained files already in `Docs/consolidated/` remain the
   standalone review/submission package and are not silently replaced.

## 2. Executive decision

Do **not** overwrite the existing consolidated files. They already summarize
the accepted product documents and current implementation:

- [Consolidated PRD](../consolidated/01_PRD_Core_Transaction_2.md)
- [Consolidated user story map](../consolidated/02_User_Story_Map.md)
- [Consolidated sprint plan](../consolidated/03_Sprint_Plan.md)
- [Consolidated technical architecture](../consolidated/04_Technical_Architecture.md)
- [Consolidated design system](../consolidated/05_Design_System_Specification.md)

Instead, add the supplied set beneath a dedicated, date-versioned supplement
directory and introduce a recommendation register. The supplements are
evidence and idea sources; the canonical documents remain the place where
accepted decisions are maintained.

## 3. Verified starting point

### 3.1 Existing documentation model

[Docs/README.md](../README.md) already establishes the following rules:

- `Docs/` is the product-documentation source of truth.
- Detailed topic documents remain authoritative when consolidated summaries
  omit detail.
- Laravel migrations and application code define currently implemented
  behavior.
- Capabilities must be labelled live backend/UI, partial, prototype, or
  planned.
- Historical plans are retained for context and do not replace current
  direction.

The existing [consolidated index](../consolidated/README.md) currently provides
download links only. It does not yet explain authority, supplement status,
provenance, or recommendation handling.

### 3.2 Accepted project direction

The current accepted direction is recorded in:

- [Top-level modules](../modules.md): five business modules, with identity,
  tracking, records, notifications, reports, attachments, GPT, and mobile
  delivery treated as shared platform services.
- [Phase 0 baseline](../phase-0-baseline.md): Laravel-backed canonical states,
  Inertia browser writes, Sanctum mobile authentication, a managed
  single-region Laravel/Supabase topology, an eight-hour offline contract, and
  explicit location/privacy limits.
- [Architecture](../Architecture.md): a modular Laravel monolith with Inertia
  3, React 19, shared domain actions, PostgreSQL/Supabase, and a focused React
  Native field client.
- [Product design](../Design.md): an amber, Instrument Sans, light-first
  operational interface with WCAG 2.2 AA expectations.
- [Roadmap](../Roadmap.md) and
  [capstone completion plan](./CAPSTONE_COMPLETION_PLAN.md): outcome-based work
  from the current implementation rather than a greenfield Sprint 0.

### 3.3 Immediate documentation risk

[Product design](../Design.md) contains an internal contradiction that must be
resolved before the supplied design-system proposal is promoted anywhere:

- its accepted foundations specify amber and Instrument Sans;
- its embedded reusable implementation prompt later requires the supplied
  blue palette and Inter and calls those values authoritative.

The implemented tokens in `resources/css/app.css` follow the accepted
amber/Instrument Sans direction. The contradictory embedded prompt should be
corrected or moved into the supplement area during reconciliation. Until that
is done, the top-level design direction, Phase 0 decision, consolidated design
system, and implemented tokens take precedence.

## 4. Authority and precedence model

Use the following order whenever two sources disagree:

| Rank | Source | Governs |
| --- | --- | --- |
| 1 | Migrations, application code, and configuration | What is implemented now |
| 2 | Passing automated tests and verified acceptance evidence | What behavior is proven |
| 3 | Accepted decision records, especially `phase-0-baseline.md` and `modules.md` | Binding product and architecture decisions |
| 4 | Canonical detailed product documents in `Docs/` | Intended behavior, rules, and planned evolution |
| 5 | Maintained files in `Docs/consolidated/` | Standalone summaries of ranks 1–4 |
| 6 | Recommendation register | Review state of extracted supplement ideas |
| 7 | Date-versioned supplemental source documents | Historical proposals and non-binding recommendations |

This hierarchy resolves two different questions:

- **What does the product do now?** Read code, migrations, and tests.
- **What should the product become?** Read accepted decisions and canonical
  product documents.

A supplement answers neither question by itself.

## 5. Proposed documentation structure

Add the following structure during implementation:

```text
Docs/
├── README.md
├── consolidated/
│   ├── README.md
│   ├── 01_PRD_Core_Transaction_2.md
│   ├── 02_User_Story_Map.md
│   ├── 03_Sprint_Plan.md
│   ├── 04_Technical_Architecture.md
│   ├── 05_Design_System_Specification.md
│   └── supplements/
│       ├── README.md
│       ├── RECOMMENDATION_REGISTER.md
│       ├── SOURCE_CROSSWALK.md
│       └── 2026-07-27-proposal/
│           ├── README.md
│           ├── 01_PRD_Core_Transaction_2.md
│           ├── 02_User_Story_Map.md
│           ├── 03_Sprint_Plan.md
│           ├── 04_Technical_Architecture.md
│           └── 05_Design_System_Specification.md
└── plans/
    └── CT2_SUPPLEMENTAL_SOURCE_INTEGRATION_PLAN.md
```

The date-versioned directory prevents filename collisions and makes later
proposal sets additive. Do not place a supplemental file beside a canonical
file with a nearly identical unqualified name.

## 6. Required metadata and warnings

Each supplemental document must begin with a common notice:

```text
Document class: Supplemental source
Source date: 2026-07-27
Imported: [date]
Authority: Non-canonical
Use: Recommendation and traceability source only
Supersession rule: Accepted Docs/ decisions and current implementation prevail
Review register: ../RECOMMENDATION_REGISTER.md
```

The date-set `README.md` must also record:

- source/provider;
- original filenames;
- whether the text is verbatim or normalized;
- import date and importer;
- source version and document status;
- hashes for any verbatim source snapshots;
- known conflicts at import time;
- the canonical files that reviewers must consult first.

If exact source preservation matters, retain a hash-verified verbatim copy and
put the warning in the directory manifest. If stand-alone distribution matters
more, prepend the warning and record that the imported copy is annotated.
Do not claim both annotated content and a verbatim hash for the same file.

## 7. Recommendation lifecycle

Every actionable idea extracted from a supplement receives one register row.
Use stable IDs such as `SUP-PRD-001`, `SUP-USM-001`, `SUP-SPR-001`,
`SUP-ARC-001`, and `SUP-DSN-001`.

### 7.1 Register fields

| Field | Purpose |
| --- | --- |
| ID | Stable supplemental recommendation identifier |
| Source document | Exact supplemental file |
| Source section/reference | Heading and original requirement/story ID where present |
| Proposal | One testable recommendation, not a copied section |
| Category | Product, workflow, architecture, data, security, delivery, design, operations, or integration |
| Canonical owner | Detailed document responsible for an accepted decision |
| Current evidence | Relevant code, migration, test, or feature-status reference |
| Conflict | Accepted decision or implementation the proposal contradicts |
| Disposition | Unreviewed, needs evidence, accepted, accepted with changes, deferred, duplicate, or rejected |
| Rationale | Decision basis and trade-off |
| Target horizon | Current capstone, post-MVP, research, or no target |
| Delivery reference | Real tracker/plan item when one exists |
| Last reviewed | Date |
| Decision owner | Role accountable for approval |

### 7.2 State rules

- **Unreviewed:** imported but not assessed.
- **Needs evidence:** potentially useful, but scale, user, legal, cost, or
  technical evidence is missing.
- **Accepted:** consistent with the current direction and approved for a
  canonical document.
- **Accepted with changes:** useful intent retained after mapping it to current
  terminology, architecture, or constraints.
- **Deferred:** valid but outside the active capstone or blocked by a decision.
- **Duplicate:** already represented by a canonical requirement.
- **Rejected:** conflicts with an accepted decision or lacks sufficient value.

Only accepted and accepted-with-changes rows may update canonical documents.
Changing the register alone does not change product scope.

## 8. Source-by-source reconciliation

### 8.1 Supplemental PRD

#### Useful source material

- Six internal personas and their operational pain points
- Candidate dispatch, utilization, adoption, and satisfaction metrics
- Feature inventories for dashboard, dispatch, schedule, live operations,
  personnel, fleet, crane/equipment, fuel, reports, administration, mobile,
  and AI
- Integration inventory and operational risk list
- Acceptance-criteria phrasing that can strengthen existing requirements

#### Required normalization

- Map the proposed module list to the accepted five business modules and shared
  platform services.
- Map every proposed dispatch label to a canonical Laravel state or classify
  it as a presentation-only concept.
- Convert hard targets such as 99.9% availability, 500 simultaneous
  dispatchers, sub-500 ms APIs, and multi-year GPS retention into evidence
  requests unless an accepted decision already supports them.
- Separate capstone requirements from post-MVP integrations and AI features.
- Treat legal/compliance statements as policy questions requiring an owner,
  jurisdiction, and evidence; do not present GDPR/CCPA compliance as complete.

#### Conflicts that must not be imported unchanged

- Eleven-stage Kanban vocabulary versus canonical Laravel state machines
- 99.9% uptime versus the accepted 99.5% capstone target
- Two-year GPS retention versus the accepted 30-day coordinate limit
- Additional top-level modules versus the accepted five-module boundary
- Dark mode and all-feature claims without current scope/evidence
- Horizontal scaling, sharding, and CDN requirements without measured need

### 8.2 Supplemental user story map

#### Useful source material

- Persona-oriented task backbone
- Fine-grained acceptance criteria
- MoSCoW priority as an input to stakeholder review
- Coverage ideas for bulk administration, communication, incident reporting,
  equipment location, reporting, and AI

#### Required normalization

- Preserve original `US-###` values only as source references. Canonical
  requirement IDs and real delivery items remain separate.
- Add a crosswalk from each source story to a canonical requirement,
  implemented capability, deferred backlog item, or rejected proposal.
- Replace the greenfield Release 1/2/3 grouping with current roadmap horizons.
- Re-estimate only after dependency, owner, implementation evidence, and team
  capacity are known.

#### Conflicts that must not be imported unchanged

- “Trigger billing export” conflicts with the current billing non-goal.
- “Advanced offline” appears after full offline is already called an MVP
  requirement and needs a precise capability split.
- The source MVP count and 8–10 week claim do not reflect the current codebase
  or remaining acceptance gates.
- Story points are proposal-era estimates, not commitments.

### 8.3 Supplemental sprint plan

#### Useful source material

- Dependency awareness across backend, web, mobile, QA, and operations
- Cross-cutting accessibility, security, performance, documentation, and
  release-readiness checks
- Potential post-MVP themes for fleet, reporting, AI, and live operations

#### Required normalization

- Treat the entire plan as a historical greenfield scenario.
- Crosswalk its deliverables to the current consolidated sprint plan and active
  capstone plan.
- Mark already-delivered items as duplicate evidence, not new work.
- Move valid uncovered items to the recommendation register.
- Use exit gates and verified starting state rather than copied week or point
  commitments.

#### Conflicts that must not be imported unchanged

- Monorepo/web/API initialization work is already superseded by the current
  Laravel repository.
- JWT, Node/NestJS, Prisma, Redis-first queues, Kubernetes, and the proposed
  infrastructure are not accepted baseline choices.
- The proposed 338-point total assumes a specific eight-person team and an
  uncalibrated velocity.
- The definition of done contains blanket requirements such as pixel-perfect
  Figma parity and fixed bundle limits that require project-specific evidence.

### 8.4 Supplemental technical architecture

#### Useful source material

- Domain-boundary vocabulary and event-flow diagrams as conceptual references
- Observability metric candidates
- Integration and failure-mode prompts
- Route optimization, anomaly detection, and predictive-maintenance options
- Performance-budget categories

#### Required normalization

- Classify the document as an alternative architecture proposal.
- Crosswalk conceptual bounded contexts to the five accepted modules without
  creating a second service taxonomy.
- Convert technology selections into options with adoption triggers, costs,
  migration impact, and rollback plans.
- Validate every data proposal against Laravel migrations and
  [Database](../database.md); never execute the supplied SQL as a migration.
- Map proposed endpoints to existing Inertia and `/api/v1` contracts in
  [HTTP API](../API.md).

#### Conflicts that must not be imported unchanged

- Node.js/NestJS/Prisma backend versus Laravel 13/Eloquent
- JWT/refresh-token browser authentication versus Laravel session/CSRF
- React Router and separate admin web app versus the accepted Inertia shell
- Microservices/CQRS/API gateway/Kubernetes as a baseline versus the accepted
  modular monolith and measured-extraction rule
- Redis, RabbitMQ, Elasticsearch, and TimescaleDB as required dependencies
- AWS RDS as primary database versus managed Supabase PostgreSQL
- Direct-client operational data assumptions versus server-only database
  access
- Proposed retention, RPO/RTO, and scaling values versus accepted baselines

Candidate technologies may be reconsidered only after an architecture decision
record names a measured constraint, compares simpler options, defines an owner,
and documents migration and rollback.

### 8.5 Supplemental design system

#### Useful source material

- Component anatomy for tables, dispatch cards, side panels, dialogs, toasts,
  forms, schedules, timelines, and map markers
- Explicit loading, empty, error, focus, reduced-motion, and color-independent
  status expectations
- Touch targets, keyboard behavior, and responsive prompts
- Candidate density, spacing, and interaction details for later usability
  review

#### Required normalization

- Separate **component behavior** from **visual tokens**.
- Compare every behavior recommendation with
  [Consolidated design system](../consolidated/05_Design_System_Specification.md)
  and current components.
- Retain accepted behavior ideas using the canonical visual language.
- Test real color combinations and components against WCAG 2.2 AA rather than
  accepting token names as proof.
- Treat dark mode as an unreviewed product recommendation unless separately
  accepted.

#### Conflicts that must not be imported unchanged

- Blue primary palette versus accepted amber brand direction
- Inter versus accepted Instrument Sans
- 256 px application sidebar versus the accepted 248 px web shell
- WCAG 2.1 AA wording versus the stricter WCAG 2.2 AA project target
- Decorative KPI-card behavior where canonical design guidance prefers dense
  operational workspaces over generic dashboard grids

The existing contradictory blue/Inter implementation prompt in
[Product design](../Design.md) is the first design reconciliation item.

## 9. Initial recommendation triage

This is a starting assessment, not final approval.

| Recommendation family | Initial disposition | Reason |
| --- | --- | --- |
| Persona pain points and task language | Accepted with changes | Useful research framing; align with canonical roles and actual workflows |
| Fine-grained acceptance criteria | Accepted with changes | Valuable when mapped to existing FRs, rules, and tests |
| Integration inventory | Needs evidence | Requires business owner, provider, data contract, security, and cost |
| Operational KPI candidates | Needs evidence | Baselines, measurement definitions, and owners are absent |
| Advanced AI/ML features | Deferred | Current GPT scope is bounded and advisory |
| Route optimization and predictive maintenance | Deferred/research | Valuable only after data quality and operational evidence exist |
| Microservices/CQRS/Kubernetes | Rejected as baseline | Conflicts with accepted modular-monolith direction |
| Redis/Elasticsearch/Timescale as mandatory | Needs evidence | Add only for measured constraints |
| Node/NestJS/Prisma replacement backend | Rejected | Conflicts with repository and accepted architecture |
| JWT browser authentication | Rejected | Conflicts with accepted session/CSRF contract |
| Blue/Inter visual system | Rejected as canonical | Conflicts with accepted amber/Instrument Sans direction |
| Component anatomy and state coverage | Accepted with changes | Reuse behavior patterns through canonical tokens and interaction rules |
| Dark mode | Needs evidence/deferred | Not an accepted active-release requirement |
| 99.9% uptime and 500-user target | Needs evidence | Accepted capstone target differs; scale is unmeasured |
| Two-year GPS retention | Rejected | Conflicts with accepted privacy/retention limit |
| Greenfield sprint estimates | Rejected as commitments | Starting state and team assumptions are obsolete |

## 10. Execution phases

### Phase 0 — Freeze authority and resolve the design prompt conflict

**Actions**

1. Confirm the authority hierarchy in this plan with Product and Engineering.
2. Record that existing consolidated deliverables cannot be overwritten by the
   incoming files.
3. Correct or relocate the blue/Inter reusable prompt in `Docs/Design.md`.
4. Verify that `Docs/Design.md`, `Docs/phase-0-baseline.md`,
   `Docs/consolidated/05_Design_System_Specification.md`, and
   `resources/css/app.css` express one design direction.

**Exit gate**

No current canonical document tells an implementer to use the rejected visual
system, and the source precedence is explicit.

### Phase 1 — Preserve and catalogue the source set

**Actions**

1. Create the date-versioned supplement directory.
2. Import all five files without changing substantive source content.
3. Add the common status notice or preserve verbatim copies with a manifest.
4. Record provenance, version, date, import mode, and hashes.
5. Create the supplement index and source crosswalk skeleton.

**Exit gate**

All files are discoverable, collision-free, provenance-labelled, and impossible
to mistake for maintained canonical deliverables.

### Phase 2 — Build the crosswalk

**Actions**

1. Break each source into atomic proposals using original IDs where available.
2. Map PRD requirements and story-map stories to the five modules and shared
   services.
3. Map source status labels to canonical enums or presentation-only concepts.
4. Map source architecture choices to accepted, undecided, optional, or
   rejected decisions.
5. Map source design guidance into behavior, tokens, layout, content, and
   accessibility categories.
6. Link each proposal to current requirements, feature status, code/test
   evidence, and roadmap horizon.

**Exit gate**

Every material source proposal has one unambiguous canonical destination or an
explicit “no destination” disposition.

### Phase 3 — Triage recommendations

**Actions**

1. Review duplicates first and close them with canonical links.
2. Reject direct contradictions already settled by accepted decisions.
3. Mark evidence-dependent proposals with the exact research or measurement
   needed.
4. Separate capstone gaps from post-MVP ideas.
5. Assign a decision owner and target review date to every unresolved item.
6. Avoid creating implementation tasks for unaccepted recommendations.

**Exit gate**

No register row remains ambiguous about owner, evidence need, conflict, and
next decision.

### Phase 4 — Update canonical documents selectively

**Actions**

1. Promote only accepted or accepted-with-changes recommendations.
2. Update the narrowest authoritative document first.
3. Update dependent summaries, story maps, roadmap status, and consolidated
   deliverables in the same change.
4. Add requirement IDs and acceptance evidence where behavior becomes binding.
5. Add an architecture decision record for any material topology or technology
   change.
6. Add a recorded design decision for any token, typography, layout, or theme
   change.

**Exit gate**

Every promoted idea exists in a canonical owner document, carries appropriate
status, and does not rely on the supplement for interpretation.

### Phase 5 — Convert accepted work into delivery items

**Actions**

1. Create delivery items only for accepted scope.
2. Include authorization, validation, state, audit, concurrency, privacy,
   accessibility, and failure acceptance where relevant.
3. Link each item back to its canonical requirement and supplemental source ID.
4. Estimate from the current code and known team capacity.
5. Place work behind existing roadmap exit gates rather than copying the
   proposal-era sprint numbers.

**Exit gate**

Each delivery item is implementation-ready, evidence-based, and traceable in
both directions.

### Phase 6 — Validate and publish

**Actions**

1. Run Markdown link and heading checks.
2. Search canonical documents for rejected stack, state, retention, and visual
   claims.
3. Verify every capability status against code/tests.
4. Review the download package as a stand-alone reader.
5. Confirm that supplement links display a visible non-canonical warning.
6. Record unresolved recommendations and the next review owner/date.

**Exit gate**

A new reviewer can identify current behavior, accepted intent, summaries,
supplements, and open recommendations without relying on oral explanation.

## 11. Exact file-change plan

| File | Planned change |
| --- | --- |
| `Docs/consolidated/README.md` | Replace the download-only page with purpose, authority, maintained deliverables, supplement links, and usage rules |
| `Docs/README.md` | Add the supplemental library and recommendation register under supporting artifacts |
| `Docs/consolidated/supplements/README.md` | Define authority, import policy, directory versions, and review workflow |
| `Docs/consolidated/supplements/RECOMMENDATION_REGISTER.md` | Add the disposition register and decision history |
| `Docs/consolidated/supplements/SOURCE_CROSSWALK.md` | Map proposal IDs/sections to canonical documents, implementation evidence, and dispositions |
| `Docs/consolidated/supplements/2026-07-27-proposal/README.md` | Record provenance, status, hashes/import mode, known conflicts, and canonical links |
| Five files in the proposal directory | Preserve and label the supplied documents |
| `Docs/Design.md` | Resolve the amber/Instrument Sans versus blue/Inter prompt contradiction |
| Canonical detailed documents | Change only for individually accepted recommendations |
| Five maintained consolidated deliverables | Refresh only after their authoritative source documents change |

## 12. Validation plan

### Documentation integrity

- All relative links resolve.
- No two links in the consolidated index use the same label for different
  authority classes.
- Every supplement has visible non-canonical status.
- Every accepted register item links to a canonical destination.
- Every rejected item records the conflicting accepted decision.
- Source IDs remain stable after import.

### Content consistency

Search canonical documents and implementation prompts for:

- Node.js, NestJS, Prisma, JWT refresh tokens, microservices, Kubernetes,
  Elasticsearch, TimescaleDB, and React Router presented as current baseline;
- non-canonical dispatch/fuel/asset states;
- 99.9% or two-year GPS retention presented as accepted;
- blue/Inter presented as canonical;
- prototype or planned capabilities described as live;
- public database access or autonomous GPT writes.

Matches are not automatically errors, but each must be contextualized as
rejected, optional, historical, or deferred.

### Implementation evidence

For any capability-status update:

- inspect the affected migrations, models, actions, policies, controllers,
  routes, Inertia pages, mobile code, and tests;
- run focused Pest and frontend/mobile checks appropriate to the claim;
- update [Feature catalog](../features.md) before refreshing summaries;
- record checks that could not run.

### Review sign-off

| Review | Required focus |
| --- | --- |
| Product | Scope, personas, priority, KPIs, non-goals |
| Engineering | Stack, state machines, contracts, data, delivery feasibility |
| Security/privacy | Auth, files, location, retention, integrations, AI data |
| Design/accessibility | Canonical visual direction, interaction behavior, WCAG 2.2 AA |
| Delivery owner | Capacity, dependencies, exit gates, rollout evidence |

## 13. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Existing consolidated files are overwritten because names match | Use a date-versioned supplement directory and protect the maintained package in the authority policy |
| Reviewers cite a supplement as an approved requirement | Put status notices in the files and indexes; require a register disposition and canonical promotion |
| Duplicate IDs are mistaken for delivery IDs | Prefix supplement register IDs and retain source `US-###` only as source references |
| Old architecture drives new implementation | Record explicit rejected/optional choices and require an architecture decision before adoption |
| Blue/Inter prompt continues to generate inconsistent UI | Resolve the current prompt contradiction in Phase 0 |
| Greenfield estimates become schedule commitments | Label them historical and estimate only from current code/team evidence |
| Compliance and scale claims are repeated without proof | Use “needs evidence,” name an owner, and define the required measurement or legal review |
| Register becomes a second backlog | Keep it a decision register; create delivery items only after acceptance |
| Canonical summaries drift after decisions | Update authoritative detail first and refresh dependent summaries in the same change |

## 14. Definition of done

The supplemental-source integration is complete when:

- all five source files are preserved under a date-versioned supplement path;
- their non-canonical status and provenance are visible;
- the existing consolidated deliverables remain intact and clearly primary;
- the consolidated and root indexes explain the authority model;
- every material source proposal is crosswalked and has a disposition or named
  evidence requirement;
- the blue/Inter versus amber/Instrument Sans documentation contradiction is
  resolved;
- accepted recommendations are promoted to canonical documents before any
  implementation work is created;
- canonical capability claims agree with code and passing tests;
- documentation links and consistency searches pass; and
- Product, Engineering, Security/Privacy, Design/Accessibility, and Delivery
  owners have reviewed their assigned recommendation categories.

## 15. Recommended execution order

1. Approve the authority model and “do not overwrite” rule.
2. Resolve the current design-prompt contradiction.
3. Import and catalogue the source set.
4. Build the source crosswalk.
5. Triage duplicates and direct conflicts.
6. Review evidence-dependent and post-MVP recommendations by owner.
7. Promote accepted items into canonical documents.
8. Create delivery work from accepted scope only.
9. Refresh the consolidated package and run final documentation QA.
