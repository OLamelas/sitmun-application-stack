# SITMUN Harness Engineering Framework

## What is this

This is the **Harness** for the SITMUN Application Stack. Instead of loading an AI with the entire codebase context on every interaction, this framework:

1. **Filters context** - each agent receives only what it needs
2. **Delegates work** - an orchestrator dispatches to specialized subagents
3. **Persists state** - progress, decisions, and history live in `.sitmun-harness/state/`
4. **Validates automatically** - tests run before any claim of completion

## Architecture

```
Orchestrator (you)
├── Implementor Agent  → writes code, follows TDD, creates minimal diffs
├── Spec Reviewer      → checks acceptance criteria and scope
├── Code Reviewer      → checks maintainability/security/integration risk
└── Tester Agent       → runs tests, verifies builds, checks integrations
```

## Directory Structure

```
.sitmun-harness/
├── ORCHESTRATOR.md         ← How the orchestrator should work
├── README.md               ← This file
├── agents/
│   ├── implementor.md      ← Implementor agent instructions
│   ├── spec-reviewer.md    ← Spec compliance reviewer instructions
│   ├── code-quality-reviewer.md ← Code quality reviewer instructions
│   ├── reviewer.md         ← Generic reviewer instructions
│   └── tester.md           ← Tester agent instructions
└── state/
    ├── progress.md         ← Overall project progress
    ├── mia-status.md       ← More Info Advanced feature status
    ├── template-status.md  ← Plantilla/Template feature status
    └── context-brief.md    ← Minimal context each agent needs
```

## How to use

1. **Orchestrator reads** `state/progress.md` to know where we are
2. **Orchestrator reads** the specific feature status file for details
3. **Orchestrator delegates** to a subagent with a focused prompt + only relevant files
4. **Subagent works**, runs tests, reports back
5. **Orchestrator verifies** the result, updates state files, commits if appropriate
6. **Repeat**

## Rules

- **No agent loads the full codebase** - only the files it needs
- **State files are the source of truth** for what's done/pending
- **Tests must pass** before any state file is updated to "done"
- **One commit per logical unit** - follow conventional commits
- **If tests fail, fix first** - never mark as done with failing tests
