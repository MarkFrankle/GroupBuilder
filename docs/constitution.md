# GroupBuilder Project Constitution

**Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Active

This document defines the core principles, workflow standards, and quality expectations for GroupBuilder development.

---

## Mission Statement

GroupBuilder exists to make thoughtful, diverse group mixing effortless for event organizers. We deliver two things exceptionally well:

1. **Intuitive UI** - Event organizers (often volunteers) should find the tool delightful to use
2. **Reliable table assignments** - The constraint solver must produce balanced, diverse assignments that respect social dynamics

Between these two, **intuitive UI takes priority** - a perfect algorithm that confuses users fails the mission. However, providing bad table assignments also fails the core mission, so we must maintain solver quality while prioritizing user experience.

---

## Core Principles

### 1. YAGNI Ruthlessly
**"You Aren't Gonna Need It"**

- No feature until the third use case demonstrates need
- Resist the temptation to add configurability "just in case"
- Remove unused code completely - no backwards-compatibility hacks
- Simple solutions beat clever ones

**Examples:**
- ✅ Hard-code reasonable defaults, add configuration only when users request it
- ❌ Adding "advanced options" that no user has asked for
- ✅ Deleting unused functions entirely
- ❌ Keeping unused code with `// TODO: might need this later` comments

### 2. TDD Always
**Test-Driven Development is non-negotiable**

- Write failing tests before implementation code
- All features include tests (unit tests for logic, integration tests for workflows)
- No claiming "done" without passing tests
- Solver correctness is sacred - constraint logic must be well-tested

**Why this matters for GroupBuilder:**
- Constraint solver regressions are hard to spot manually
- Diversity balancing logic is complex and error-prone
- Future optimizations must not break correctness

### 3. Intuitive UI First
**User experience is the primary mission**

- Event organizers are often non-technical volunteers with limited time
- Every UI decision prioritizes clarity over features
- Error messages must be helpful, not technical
- The happy path should be obvious without documentation

**Quality questions:**
- Can a volunteer coordinator use this without training?
- Are error messages actionable?
- Does the UI guide users toward success?

### 4. Solver Quality Matters
**Don't break the core assignment logic**

- Constraint correctness > solver speed
- Performance goal: <2min solve time for typical events (4min acceptable for complex cases)
- Test edge cases: unbalanced inputs, odd table sizes, many sessions
- Profile before optimizing

**Trade-offs:**
- Fast but incorrect > slow and correct ❌
- Slow but correct > fast and incorrect ✅
- Fast and correct > slow and correct ✅

### 5. Documentation Lives With Code
**Specs, plans, and decisions are versioned artifacts**

- Feature specs in `docs/specs/` before implementation
- Implementation designs in `docs/plans/`
- ADRs (Architecture Decision Records) capture "why" for significant choices
- README stays current with actual functionality

---

## Workflow Standards

### Development Workflow
Every feature follows this sequence:

1. **Spec** (`speckit-specify`) - What are we building and why?
2. **Clarify** (`speckit-clarify`) - Fill in gaps with targeted questions
3. **Plan** (`speckit-plan`) - How will we implement it?
4. **Tasks** (`speckit-tasks`) - Break down into ordered steps
5. **TDD** (`test-driven-development`) - Write tests first
6. **Implement** - Write the code
7. **Verify** (`verification-before-completion`) - Confirm tests pass

### Todo List Discipline
**Comprehensive, detailed task tracking is mandatory**

- Break work into granular, trackable todos
- Include self-review checkpoints (validate with self or sub-agents)
- Mark todos complete immediately when finished
- One todo in-progress at a time (focus)

**Good todos:**
- ✅ "Write test for couple separation constraint"
- ✅ "Self-review: Verify all diversity balancing tests pass"
- ✅ "Update API endpoint to validate table count 1-10"

**Bad todos:**
- ❌ "Fix solver" (too vague)
- ❌ "Implement feature" (not granular)
- ❌ "Test everything" (not actionable)

### Git Workflow (Hybrid)

**Small changes (1-2 files):**
- Work in current branch
- Standard git workflow

**Major features (3+ files, complex changes):**
- Use `using-git-worktrees` for isolation
- Enables parallel work on multiple features
- Clean separation between experimental work and stable code

**All branches:**
- End with `finishing-a-development-branch` to structure merge/PR/cleanup
- All PRs include tests and pass CI
- Commit messages explain "why", not just "what"

### Debugging
When encountering bugs or failures:

- Use `systematic-debugging` for mysterious behavior
- Root cause analysis before fixes
- Add regression tests after fixing bugs
- Document non-obvious solutions

---

## Quality Gates

### Before Claiming "Done"
- [ ] All tests pass (unit + integration)
- [ ] Solver correctness tests validate constraints
- [ ] Performance tests ensure solve times reasonable (<2min typical, <4min complex)
- [ ] UI changes tested manually
- [ ] Documentation updated (if public-facing change)

### Before Merging PRs
- [ ] CI passes
- [ ] Code review complete
- [ ] No TODOs or FIXMEs without linked issues
- [ ] Changelog updated (if user-facing)

### Before Deployment
- [ ] All tests pass in production environment
- [ ] Performance validated with production-like data
- [ ] Rollback plan documented
- [ ] Monitoring/logging in place

---

## Technical Constraints

### Language & Framework Versions
- **Python:** 3.10+ (OR-Tools compatibility requirement)
- **React:** 18+ (modern hooks, concurrent features)
- **FastAPI:** Current stable (async/await, Pydantic v2)
- **Node.js:** 16+ (frontend build tooling)

### Dependencies
- **OR-Tools:** Core constraint solver - updates must be tested thoroughly
- **Pandas:** Excel processing - keep stable, avoid breaking changes
- **Tailwind + Radix UI:** Frontend styling/components

### Performance Budgets
- **API response time:** <200ms (excluding solver)
- **Solver time goal:** <2min for typical events (50 people, 5 tables, 6 sessions)
- **Solver time acceptable:** <4min for complex events (100 people, 10 tables, 6 sessions)
- **Frontend bundle:** <500KB gzipped (initial load)

### Browser Support
- Modern evergreen browsers (last 2 versions)
- Chrome, Firefox, Safari, Edge
- No IE11 support

---

## Decision-Making Framework

When evaluating feature requests or design choices:

1. **Does it serve the mission?** (Intuitive UI + reliable assignments)
2. **Is there a third use case?** (YAGNI check)
3. **Does it maintain solver quality?** (Correctness + performance)
4. **Will it confuse users?** (Simplicity check)
5. **Can we test it?** (TDD check)

If the answer to any is "no", defer or reject.

---

## Anti-Patterns to Avoid

### Code
- ❌ Clever abstractions that save 3 lines of code
- ❌ Configuration options "just in case"
- ❌ Skipping tests because "it's a small change"
- ❌ Optimizing before profiling

### Process
- ❌ Implementing before spec/plan
- ❌ Claiming "done" without running tests
- ❌ Vague todos ("fix the thing")
- ❌ Batching completed todos instead of marking immediately

### UI
- ❌ Technical jargon in user-facing messages
- ❌ Hidden features that require documentation
- ❌ Error messages that don't explain how to fix
- ❌ Multi-step wizards for simple tasks

---

## Evolution of This Constitution

This is a living document. Update it when:

- Core principles change or are clarified
- New workflow standards emerge from practice
- Technical constraints shift (dependency updates, etc.)
- Anti-patterns are identified through experience

All updates should be committed with clear rationale in the commit message.

---

## Accountability

When reviewing code or planning work, ask:
- "Are we following TDD?"
- "Is this YAGNI, or are we gold-plating?"
- "Will this confuse event organizers?"
- "Do we have comprehensive todos?"
- "Are we testing solver correctness?"

This constitution exists to keep us honest and focused on the mission.

---

**Signed off by:** Mark Frankle
**Established:** 2026-01-11
**Next review:** When needed
