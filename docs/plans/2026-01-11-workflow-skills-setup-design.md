# Workflow Skills Setup Design

**Date:** 2026-01-11
**Status:** Approved
**Author:** Claude + Mark

## Overview

Establish a disciplined, three-tier development workflow for GroupBuilder using Claude Code skills. The workflow emphasizes comprehensive planning, test-driven development, and structured git practices while maintaining focus on the core mission: intuitive UI and reliable table assignments.

## Problem Statement

GroupBuilder was initially built "raw-dogging it with Opus" - effective for rapid prototyping but lacking systematic workflows for ongoing development. As the project matures, we need:

- **Consistent planning** - Feature specifications before implementation
- **Quality discipline** - TDD, systematic debugging, verification gates
- **Workflow reproducibility** - Version-controlled skill configuration
- **Comprehensive task tracking** - Detailed todo lists with review checkpoints

## Design Decisions

### Three-Tier Workflow Architecture

**Tier A: Planning & Specification (Spec-Kit)**
- Auto-invoke `speckit-specify` on feature requests
- Formal specs in `docs/specs/`
- `speckit-clarify` for targeted requirement questions
- `speckit-plan` for implementation designs
- `speckit-tasks` for ordered task lists
- Until user gets "bored of it" - can dial back later

**Tier B: Development Workflows**
- **TDD always**: `test-driven-development` before any implementation
- **Systematic debugging**: Structured approach for all bugs/failures
- **Verification gates**: `verification-before-completion` before "done" claims
- **Comprehensive todos**: Detailed task breakdowns with self-review checkpoints

**Tier C: Git Workflows (Hybrid)**
- **Small changes (1-2 files)**: Work in current branch
- **Major features (3+ files)**: Use `using-git-worktrees` for isolation
- **All completions**: `finishing-a-development-branch` for merge/PR/cleanup

### Configuration Strategy

**Hybrid Approach:**
- Skills configured in `.claude/settings.local.json` permissions
- Invocation based on context (AI judgment + rules)
- No complex hooks initially - rely on AI to invoke at right times

**Version Control:**
- Track `.claude/` in git (no more "mid-2025 shame")
- Reproducible workflow for collaborators
- Custom skills in `.claude/skills/` for GroupBuilder-specific patterns

## File Structure

```
.claude/
├── settings.local.json    # Skills permissions, config
├── skills/                # Custom GroupBuilder skills (future)
│   └── README.md         # Explains purpose and how to create
└── cclsp.json            # (existing LSP config)

docs/
├── specs/                # Feature specifications (spec-kit)
├── plans/                # Implementation designs (spec-kit)
├── guides/               # DEPLOYMENT.md, TESTING.md (moved from root)
├── archive/              # Old planning docs (BACKEND_PLAN.md, etc.)
└── constitution.md       # Project principles

.gitignore               # Updated to track .claude/
```

## Project Constitution

**Core Principles:**
1. **YAGNI ruthlessly** - No feature until third use case
2. **TDD always** - Tests before implementation, no exceptions
3. **Intuitive UI first** - User experience is the primary mission
4. **Solver quality matters** - Don't break the core assignment logic
5. **Documentation lives with code** - Specs in `docs/specs/`, designs in `docs/plans/`

**Workflow Rules:**
- Every feature: Spec → Plan → Tasks → TDD → Implement → Verify
- **Comprehensive todo lists** - Break work into detailed, trackable tasks
- **Self-review checkpoints** - Regular validation with self or sub-agents
- Worktrees for features touching 3+ files
- All PRs include tests and pass CI
- Systematic debugging for any mysterious behavior

**Quality Gates:**
- All tests pass before claiming "done"
- Solver correctness tests validate constraints
- Performance goal: <2min solve time (4min acceptable for complex cases)

**Tech Constraints:**
- Python 3.10+ (OR-Tools compatibility)
- React 18+ (frontend)
- FastAPI (backend stability)

## Implementation Plan

1. **Update `.gitignore`** - Remove `.claude/` exclusion
2. **Configure skills** - Update `.claude/settings.local.json` with full permissions
3. **Create directory structure** - `docs/{specs,plans,guides,archive}`, `.claude/skills/`
4. **Create documentation**:
   - `.claude/skills/README.md` - Custom skills guide
   - `docs/constitution.md` - Project principles
5. **Archive old docs** - Move `BACKEND_PLAN.md`, `*_COMPLETED.md` to `docs/archive/`
6. **Move guides** - `DEPLOYMENT.md`, `TESTING.md` → `docs/guides/`
7. **Commit workflow setup** - Version control the configuration
8. **Test workflow** - Use new workflow to plan first real feature task

## Success Metrics

- [ ] Spec-kit automatically invokes on feature requests
- [ ] TDD skill enforces test-first development
- [ ] Comprehensive todos created for all work
- [ ] Old planning docs archived, no confusion about current docs
- [ ] Workflow successfully used for at least one real feature
- [ ] Team (Mark) not "bored of it" yet 😄

## Trade-offs

**Pros:**
- Systematic approach prevents scope creep
- Tests ensure solver quality doesn't regress
- Documentation enables future collaboration
- Reproducible workflow across sessions

**Cons:**
- More upfront ceremony for simple changes
- May feel heavy initially (can dial back later)
- Learning curve for spec-kit workflow
- Requires discipline to maintain

## Future Considerations

**Custom Skills Candidates:**
- `constraint-solver-tuning` - Workflow for OR-Tools parameter adjustments
- `diversity-balancing-validation` - Verify balancing logic correctness
- `test-data-generation` - Create realistic participant test sets
- `performance-profiling` - Structured approach to solve time optimization

**Potential Adjustments:**
- If Tier A feels too heavy, move to hybrid (spec-kit for major features only)
- Add hooks if manual invocation becomes tedious
- Integrate with CI/CD as deployment workflow matures

## References

- Spec-Kit: spec-kit@claude-night-market
- Superpowers: superpowers@superpowers-marketplace
- Imbue: imbue@claude-night-market (scope-guard)
