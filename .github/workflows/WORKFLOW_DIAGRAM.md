# CI/CD Workflow Diagram

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Event Triggers                         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
        ┌────────────────┐  ┌──────────┐  ┌──────────────┐
        │ Push to Branch │  │ Push to  │  │ Pull Request │
        │  (any branch)  │  │   Main   │  │  to Main     │
        └────────────────┘  └──────────┘  └──────────────┘
                    │              │              │
                    ▼              ▼              ▼
        ┌────────────────┐  ┌──────────────────────────┐
        │   Lint Only    │  │     Full Test Suite      │
        │                │  │                          │
        │  ✓ ESLint      │  │  ✓ Lint                 │
        │                │  │  ✓ Unit Tests           │
        │  FAST ⚡       │  │  ✓ Integration Tests    │
        │  (~1-2 min)    │  │  ✓ E2E Tests            │
        │                │  │  ✓ Build Check          │
        │                │  │                          │
        │                │  │  THOROUGH 🛡️            │
        │                │  │  (~5-10 min)            │
        └────────────────┘  └──────────────────────────┘
```

## Workflow Decision Tree

```
                    Commit / PR Event
                           │
                           ▼
                  ┌────────────────┐
                  │ Is it a Push?  │
                  └────────────────┘
                     │           │
                 Yes │           │ No (Pull Request)
                     ▼           ▼
         ┌──────────────────┐   ┌─────────────────────┐
         │ Is it to 'main'? │   │ Run FULL TEST SUITE │
         └──────────────────┘   │                     │
              │         │        │ • Lint              │
          Yes │         │ No     │ • Unit Tests        │
              │         │        │ • Integration Tests │
              ▼         ▼        │ • E2E Tests         │
    ┌─────────────┐  ┌────────┐ │ • Build             │
    │ FULL TESTS  │  │ LINT   │ └─────────────────────┘
    │ (Complete)  │  │ ONLY   │
    └─────────────┘  └────────┘
```

## Job Dependency Graph (Full Test Suite)

```
                    ┌──────┐
                    │ Lint │
                    └───┬──┘
                        │
        ┌───────────────┼────────────────┬──────────────┐
        │               │                │              │
        ▼               ▼                ▼              ▼
   ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌────────┐
   │  Unit   │    │Integration│   │   E2E   │    │ Build  │
   │  Tests  │    │   Tests   │   │  Tests  │    │ Check  │
   └────┬────┘    └─────┬─────┘   └────┬────┘    └───┬────┘
        │               │              │              │
        └───────────────┼──────────────┼──────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  All Tests       │
              │  Complete ✓      │
              └──────────────────┘
```

## Environment Variables & Secrets Required

### For All Workflows
- None (lint doesn't need secrets)

### For Full Test Suite

#### Integration Tests
```yaml
SUPABASE_TEST_URL: ${{ secrets.SUPABASE_TEST_URL }}
SUPABASE_TEST_SERVICE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_KEY }}
```

#### Build Job
```yaml
NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

## Conditional Execution Logic

The workflow uses this condition to determine which jobs to run:

```yaml
if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
```

### This means:
- ✅ Run on: Any Pull Request
- ✅ Run on: Push to `main` branch
- ❌ Skip on: Push to feature/dev branches

## Quick Reference

| Event Type            | Lint | Unit | Integration | E2E | Build | Duration |
|-----------------------|------|------|-------------|-----|-------|----------|
| Push to feature branch| ✅   | ❌   | ❌          | ❌  | ❌    | ~1-2 min |
| Push to main          | ✅   | ✅   | ✅          | ✅  | ✅    | ~5-10 min|
| Pull Request to main  | ✅   | ✅   | ✅          | ✅  | ✅    | ~5-10 min|

## Benefits Summary

### For Developers 👨‍💻
- **Fast feedback** on code style issues
- **Don't waste time** waiting for full tests on WIP branches
- **Comprehensive checks** before merging

### For CI/CD Pipeline 🚀
- **Efficient resource usage** - Full tests only when needed
- **Cost effective** - Reduced CI minutes consumption
- **Protected main branch** - Always verified before merge

### For Team 👥
- **Clear status indicators** on PRs
- **Confidence in main branch** stability
- **Consistent code quality** standards

