# Project Instructions

## Project

Laravel 13 application using PHP, Laravel Sanctum, Spatie Laravel Permission,
Inertia 3, React 19, TypeScript, Vite, Pest 4, PHPStan, Laravel Pint, ESLint,
and Prettier.

For product or interface work, read the relevant documents in `Docs/` first.
`Docs/README.md` is the index; product documents define intended behavior, while
migrations and application code define currently implemented behavior.

## Working rules

1. Inspect affected code, tests, and nearby conventions before editing.
2. Make the smallest cohesive change that fulfils the request; preserve
   unrelated user changes.
3. For bugs and features, prefer focused Pest coverage of externally visible
   behavior, including authorization, validation, state changes, and meaningful
   failures when applicable.
4. Validate in proportion to risk and report checks that could not run.
5. Do not commit, push, or open a pull request unless explicitly asked.
6. AI Quality Gate: For every code change, feature, bug fix, refactor, or sprint implementation, evaluate and document responses to the 4 mandatory AI verification questions in [`.ai-reports/ai-verification-questions.md`](file:///c:/Users/User/Desktop/Core-2/.ai-reports/ai-verification-questions.md):
   - Did you build this the most secure way?
   - Did you build this the most efficient way?
   - What regressions could this introduce?
   - What tests do we need to write before we ship this?

## Security and quality

- Treat all external input as untrusted. Validate at system boundaries, enforce
  authorization, protect secrets and personal data, use Eloquent/parameterized
  queries, and keep CSRF protection intact.
- Apply rate limiting to sensitive or abuse-prone endpoints.
- Follow existing Laravel, Inertia, React, and TypeScript patterns. Preserve
  type safety, accessibility, responsive behavior, and existing design tokens.
- Use transactions for atomic multi-write operations and avoid N+1 queries.
- Prefer explicit state transitions and immutable values except where framework
  conventions require mutation.

## Validation

Use focused checks while iterating; run broader checks when change risk
warrants it:

- PHP: `composer lint:check`, `composer types:check`, `php artisan test`, or
  `composer test`
- Frontend: `npm run lint:check`, `npm run format:check`,
  `npm run types:check`, or `npm run build`
- CI-equivalent: `composer ci:check`

## ECC resources

This repository uses Everything Claude Code (ECC) `2.0.0-rc.1`. Read only the
resources relevant to the task and follow any selected skill completely.

- Domain skills: `.agents/skills/laravel-patterns/`, `laravel-tdd/`,
  `laravel-security/`, `laravel-verification/`, and `impeccable/`
- Specialist roles: `.agents/skills/*.md` (planner, architecture, TDD, review,
  security, database, TypeScript, build, E2E, documentation, performance)
- Shared rules: `.agents/rules/`; workflows: `.agents/workflows/`; extended
  skills: `.agents/.agents/skills/`

For complex or specialized work, use the relevant specialist definition: read
it before delegating, keep ownership boundaries clear, and use parallel work
only for genuinely independent subtasks. After code changes, use the relevant
reviewer and resolve critical or high-confidence findings. For security-
sensitive changes, complete a security review.

## Task routing

- Laravel architecture or database work: read laravel-patterns; bugs and features: laravel-tdd.
- Authentication, APIs, user input, files, payments, or secrets: laravel-security.
- React or Inertia interface work: impeccable; TypeScript changes: the TypeScript reviewer.
- Documentation: doc-updater; build or type failures: uild-error-resolver.
- After code changes, use the relevant reviewer; use laravel-verification for broader release checks.

When committing, use `<type>: <user-visible outcome>` with one of `feat`,
`fix`, `refactor`, `docs`, `test`, `chore`, `perf`, or `ci`.