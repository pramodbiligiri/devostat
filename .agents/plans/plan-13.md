# Plan 13: Local file-based task tracking as alternative to Linear

## Context
The code-flow plugin currently depends on Linear for all task state tracking. This means users can't try the workflow without a Linear account and the Linear MCP server configured. Adding a local file-based alternative makes the plugin accessible to anyone with just Claude Code.

**Linear feature issue:** PB-221

## Design decisions

- **Format: XML** — machine-writable, extensible, not whitespace-sensitive (unlike YAML). Human readability deferred to a future viewer tool.
- **File location: `.agents/plans/plan-{N}-tasks.xml`** — sibling to the plan file. Keeps the flat directory structure, no migration needed for existing plans, compatible with existing git tag conventions.
- **Scripts: TypeScript, pre-compiled to JS** — TS source in `scripts/tasks/` in the plugin repo. SessionStart hook runs `tsc` once into `${CLAUDE_PLUGIN_DATA}/dist/`. Runtime invocation is plain `node`. TS source also copied to `${CLAUDE_PLUGIN_DATA}/src/` for browsing.
- **Dependencies: `typescript` + `fast-xml-parser`** (~26MB) — installed in `${CLAUDE_PLUGIN_DATA}` via SessionStart hook using the documented diff-and-install pattern from the [plugins reference](https://code.claude.com/docs/en/plugins-reference#persistent-data-directory).
- **Mode detection:** SKILL.md uses `[Linear]` / `[Local]` inline markers at divergence points. Unmarked instructions apply to both modes.

## XML schema

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plan-tasks plan="13" description="Short description" plan-version="plan-13-v1">
  <metadata>
    <backlog-issue>PB-221</backlog-issue>
    <status>active</status> <!-- active | complete | abandoned | in-review -->
    <created>2026-04-09</created>
  </metadata>

  <tasks>
    <task id="1" risk="high" status="pending">
      <name>Task name here</name>
      <commit></commit>
      <created-from>plan-13-v1</created-from>
      <closed-at-version></closed-at-version>
      <comments>
        <comment timestamp="2026-04-09T14:00:00Z">De-risk validated: approach works.</comment>
      </comments>
      <deviations>
        <deviation type="minor" timestamp="2026-04-09T15:00:00Z">Split into two sub-tasks because...</deviation>
      </deviations>
    </task>
  </tasks>

  <project-updates>
    <update timestamp="2026-04-09T13:00:00Z">Plan ready for review.</update>
    <update timestamp="2026-04-09T16:00:00Z" blocked="true">Blocked: fundamental issue with approach X.</update>
  </project-updates>
</plan-tasks>
```

Valid task statuses: `pending`, `in-progress`, `de-risked`, `agent-coded`, `closed`, `needs-triage`, `abandoned`

## Linear operation → XML mapping

| # | Linear operation | XML equivalent |
|---|---|---|
| 1 | Create `[agent]` project | Create `plan-{N}-tasks.xml` with metadata |
| 2 | Create task issues | Add `<task>` elements |
| 3 | Update task status | Update `status` attribute on `<task>` |
| 4 | Post comment for review | Append `<comment>` to task |
| 5 | Record commit reference | Update `<commit>` element |
| 6 | Log minor deviation | Append `<deviation type="minor">` |
| 7 | Flag major deviation | Append `<update blocked="true">` at project level |
| 8 | Close task | Set status to `closed`, record closing version |
| 9 | Mark needs-triage | Set status to `needs-triage` |
| 10 | Complete/archive project | Set metadata status to `complete` |
| 11 | Record audit trail | `<created-from>` and `<closed-at-version>` per task |
| 12 | Post project update | Append `<update>` to `<project-updates>` |

## TypeScript scripts

Located at `scripts/tasks/` in the plugin repo. Each script handles one or more XML operations:

| Script | Operations covered | Example invocation |
|---|---|---|
| `init.ts` | #1, #2 | `node dist/init.js --plan 13 --tasks-from .agents/plans/plan-13.md` |
| `update-status.ts` | #3, #8, #9 | `node dist/update-status.js --plan 13 --task 2 --status agent-coded` |
| `add-comment.ts` | #4 | `node dist/add-comment.js --plan 13 --task 2 --message "De-risk validated"` |
| `set-commit.ts` | #5 | `node dist/set-commit.js --plan 13 --task 2 --commit a1b2c3d` |
| `add-deviation.ts` | #6 | `node dist/add-deviation.js --plan 13 --task 2 --type minor --message "Split task"` |
| `project-update.ts` | #7, #10, #12 | `node dist/project-update.js --plan 13 --message "Ready for review"` |
| `show.ts` | (read-only) | `node dist/show.js --plan 13` (pretty-print current state) |

All scripts read/write `.agents/plans/plan-{N}-tasks.xml` relative to the repo root.

## Plugin infrastructure

### package.json (in plugin repo root)
```json
{
  "dependencies": {
    "typescript": "^5.x",
    "fast-xml-parser": "^5.x"
  }
}
```

### tsconfig.json (in plugin repo root)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "${CLAUDE_PLUGIN_DATA}/dist",
    "rootDir": "./scripts/tasks",
    "strict": true
  },
  "include": ["scripts/tasks/**/*.ts"]
}
```

### SessionStart hook (in hooks/hooks.json)
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "diff -q \"${CLAUDE_PLUGIN_ROOT}/package.json\" \"${CLAUDE_PLUGIN_DATA}/package.json\" >/dev/null 2>&1 || (cd \"${CLAUDE_PLUGIN_DATA}\" && cp \"${CLAUDE_PLUGIN_ROOT}/package.json\" . && npm install && cp \"${CLAUDE_PLUGIN_ROOT}/tsconfig.json\" . && npx tsc -p . && cp -r \"${CLAUDE_PLUGIN_ROOT}/scripts/tasks\" \"${CLAUDE_PLUGIN_DATA}/src\") || rm -f \"${CLAUDE_PLUGIN_DATA}/package.json\""
      }]
    }]
  }
}
```

### SKILL.md changes
- Add "Task Tracking Mode" section after Core Invariants
- Add `[Linear]`/`[Local]` markers at ~10 divergence points (enumerated in Linear operation mapping above)
- Update Core Invariant 3 for local mode: reference feature motivation in Context section
- Update Core Invariant 4: "Linear or the local tasks file tracks task state only"
- Update "What Lives Where" table with local mode row
- Update Repository Structure to show tasks.xml files

## Tasks (risk-sorted: High → Medium → Low)

### Task 1: SessionStart hook — install deps and compile [High]
- Add `package.json` with `typescript` + `fast-xml-parser` dependencies
- Add `tsconfig.json`
- Create a minimal `scripts/tasks/hello.ts` test file (imports fast-xml-parser, logs success)
- Create `hooks/hooks.json` with SessionStart hook using the diff-and-install pattern
- Rebuild dev plugin (`mvn process-resources`)

### Task 2: Manually verify deps installation [High]
- **Human task.** Start a new Claude session with the dev plugin enabled.
- Confirm `${CLAUDE_PLUGIN_DATA}` contains: `node_modules/`, compiled `dist/hello.js`, and `src/` with TS source copy.
- Run `node ${CLAUDE_PLUGIN_DATA}/dist/hello.js` to confirm it executes.
- If this fails, diagnose and fix before proceeding. The approach may need rethinking.
- **Nothing proceeds until this passes.**

### Task 3: Update SKILL.md with `[Linear]`/`[Local]` mode markers [High]
- Add "Task Tracking Mode" section
- Add markers at all 10+ divergence points
- Update Core Invariants 3 and 4
- Update "What Lives Where" table
- Update Repository Structure

### Task 4: Implement `init.ts` — create tasks XML from plan file [Medium]
- Parse plan markdown to extract task names (`### Task N:` pattern)
- Generate XML with proper schema, all tasks set to `pending`
- Accept risk levels as CLI args or default to unset

### Task 5: Create TypeScript project infrastructure [Low]
- `scripts/tasks/` directory structure
- Shared types/interfaces for the XML schema (task statuses, risk levels, etc.)

### Task 6: Implement `update-status.ts` — change task status [Low]
- Parse XML, find task by id, update status attribute
- Validate status transitions
- Update `<closed-at-version>` when status becomes `closed`

### Task 7: Implement `add-comment.ts` and `add-deviation.ts` [Low]
- Append child elements to a task's comments/deviations sections
- Auto-generate ISO timestamps

### Task 8: Implement `set-commit.ts` and `project-update.ts` [Low]
- `set-commit`: update commit element on a task
- `project-update`: append to project-updates, handle `blocked` flag, update metadata status

### Task 9: Implement `show.ts` — pretty-print task state [Low]
- Read XML and output a human-readable summary (task table + recent updates)

### Task 10: Update README.md [Low]
- Note local task tracking as an alternative to Linear in Features section

## Files to create/modify
- **Create:** `scripts/tasks/hello.ts` (test file, later replaced by real scripts)
- **Create:** `scripts/tasks/types.ts`, `init.ts`, `update-status.ts`, `add-comment.ts`, `add-deviation.ts`, `set-commit.ts`, `project-update.ts`, `show.ts`
- **Create:** `hooks/hooks.json`
- **Modify:** `package.json` — add dependencies
- **Create:** `tsconfig.json`
- **Modify:** `skills/code-flow/SKILL.md` — add local mode
- **Modify:** `README.md` — mention local mode

## Verification
1. Rebuild dev plugin (`mvn process-resources`) after Task 1
2. Start new Claude session — confirm SessionStart hook installs deps and compiles TS (Task 2)
3. Run `node dist/init.js --plan 99 --tasks-from .agents/plans/plan-12.md` — confirm valid XML generated
4. Run each script against test XML — confirm operations produce valid XML
5. Run `mvn process-resources` — confirm SKILL.md with new sections copies to dev build
6. Read modified SKILL.md end-to-end for logical consistency between Linear and Local modes
