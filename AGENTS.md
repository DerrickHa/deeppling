# Agent Operating Rules

## Mandatory Context Sync
- Update `agent.md` whenever you modify any repository file (code, config, tests, docs, or scripts).
- Do not finish a task with file edits unless `agent.md` is updated in the same turn.

## Required `agent.md` Delta
- What changed.
- Why the change was made.
- Which requirements or invariants were affected.
- Which files were touched.
- Validation performed (tests, lint, manual checks) and outcomes.
- Risks, follow-ups, and open questions.

## Update Style
- Append updates under `## Change Log` using a dated entry.
- Keep entries concise, factual, and specific to implementation decisions.
- If no files were changed, do not update `agent.md`.

## Escalation
- If rationale or requirements are unclear, ask the user before finalizing code edits.
