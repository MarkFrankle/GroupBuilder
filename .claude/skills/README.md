# GroupBuilder Custom Skills

This directory contains custom skills specific to GroupBuilder development workflows.

## What are Custom Skills?

Custom skills are project-specific workflow automations that capture domain knowledge and repetitive processes unique to GroupBuilder. They're different from marketplace skills (like spec-kit, TDD, etc.) which are general-purpose.

## When to Create a Custom Skill

Create a custom skill when you notice:

1. **Repetitive multi-step workflows** - You're doing the same 3+ step process repeatedly
2. **Domain-specific patterns** - Workflows that only make sense for GroupBuilder (constraint solver tuning, diversity balancing, etc.)
3. **Onboarding value** - The workflow would help new contributors understand how to work on specific parts of the codebase
4. **Quality gates** - Validation steps that should always happen for certain types of changes

## Skill Candidates for GroupBuilder

Based on our project, good candidates for custom skills include:

- **`constraint-solver-tuning`** - Systematic approach to adjusting OR-Tools CP-SAT parameters
  - When solve times exceed goals
  - How to profile constraint propagation
  - Parameter trade-offs (search strategy, timeout, etc.)

- **`diversity-balancing-validation`** - Verify balancing logic correctness
  - Test data generation for edge cases
  - Validation that constraints are working as intended
  - Performance benchmarking for different problem sizes

- **`test-data-generation`** - Create realistic participant test sets
  - Generate diverse participant profiles
  - Edge cases (unbalanced religions, odd table sizes, couples)
  - Export to Excel format for testing

- **`deployment-workflow`** - Structured deployment process
  - Pre-deployment checklist
  - Cloud Run deployment steps
  - Post-deployment verification

- **`performance-profiling`** - Systematic solve time optimization
  - Profiling OR-Tools solver performance
  - Identifying bottlenecks in constraint model
  - Benchmarking before/after optimizations

## Skill Structure

Custom skills follow this format:

```
.claude/skills/
└── skill-name/
    ├── SKILL.md           # Main skill content
    └── [supporting files] # Optional: examples, templates, etc.
```

The `SKILL.md` file contains:
- Skill metadata (name, description, when to use)
- Step-by-step workflow instructions
- Decision trees and checklists
- Examples and anti-patterns

## How to Create a Custom Skill

Use the `superpowers:writing-skills` skill to create new custom skills:

```
/writing-skills
```

This will guide you through:
1. Identifying the workflow to capture
2. Writing clear, actionable instructions
3. Testing the skill
4. Documenting when it should be invoked

## Invoking Custom Skills

Once created, skills are invoked with:

```
Skill(groupbuilder:skill-name)
```

Or they can be configured to trigger automatically based on context (e.g., performance profiling when tests show slow solve times).

## Contributing

When you identify a repetitive workflow worth capturing:
1. Note it in conversation with Claude
2. Use `superpowers:writing-skills` to formalize it
3. Test it on a real task
4. Commit the skill to this directory
5. Update this README with the new skill

## Current Custom Skills

_(None yet - this is a placeholder for future skills)_

---

**Last updated:** 2026-01-11
