# Conventions

How work moves through this repository.

Everything below follows the conventions of the TUUCI ecosystem (`tuuci-agent`), derived from the actual git history and standards established by Brian.

---

## Commits

Conventional commits: `type(scope): imperative subject`.

Allowed types:
- `feat`: new behaviour
- `fix`: corrects behaviour that was wrong
- `docs`: documentation only
- `chore`: no behaviour change (renames, ignores, config)
- `refactor`: behaviour preserved, structure changed
- `test`: tests only
- `i18n`: translation strings
- `deploy`: deployment configuration

**Bodies carry the reasoning.** Explain what was wrong before, not just what changed, and end with the verification evidence:
```
Verified: npm test; verify:prod-boot.
```

---

## Branches

```
feat/<topic>   fix/<topic>   docs/<topic>   chore/<topic>
```

Branch from `main`. Never commit directly to `main`.

---

## Larger changes: spec → plan → implement

For work that spans more than a couple of files, this repository uses the written pipeline under `docs/superpowers/`:

```
docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md    what and why, agreed before code
docs/superpowers/plans/YYYY-MM-DD-<topic>.md           numbered tasks, each independently testable
```

The spec is approved before the plan is written; the plan is approved before code is written. Both are committed so the technical decisions survive the branch.

---

## Code conventions

- **Comments explain why, not what.** Record technical decisions and their alternatives.
- **Fail closed.** Security and authorization logic refuse to proceed rather than falling back to permissive defaults.
- **Language.** Technical comments, commit messages, and documentation in English. User-facing strings support English and Spanish.
- **Data-driven state machine.** State lifecycle logic evaluates database flags (`permite_escaneo`, `dispara_activacion_siguiente`, `visible_para_operador`) rather than hardcoded status strings.

---

## Before you merge anything

```bash
npm test                    # backend unit & integration tests
npm run verify:prod-boot    # production boot safety checks
cd admin-frontend && npx tsc -b --noEmit && npm run lint
```
