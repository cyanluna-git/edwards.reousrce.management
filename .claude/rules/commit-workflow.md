# Git Workflow & Commit Guide

> **Created**: 2026-02-12 (Thu) 00:35 UTC

## Branching Strategy

### Main Branches

- **`main`** — Production-ready code. Protected, requires PR review.
- **`develop`** (if used) — Integration branch for features.

### Feature Branches

**Format:** `feature/{short-description}` or `fix/{short-description}`

```bash
# Create from main
git checkout main
git pull origin main
git checkout -b feature/user-authentication

# Or from develop
git checkout develop
git checkout -b feature/dashboard-redesign
```

## Commit Message Convention

### Format (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation changes
- **style:** Code style changes (formatting, missing semicolons, etc.)
- **refactor:** Code refactoring without feature/bug changes
- **perf:** Performance improvement
- **test:** Test additions or changes
- **chore:** Build, CI, dependencies

### Examples

```
feat(auth): add JWT token refresh endpoint

Implements automatic token refresh on 401 responses.
Refresh tokens valid for 7 days.
Access tokens expire in 30 minutes.

Closes #42

fix(worklog): handle null user_id in resource plan

TBD positions (user_id=null) now correctly display
in the resource allocation view.

refactor(api): extract pagination logic to dependency

Move pagination parameter parsing to reusable Depends().
Reduces code duplication across endpoints.

docs: update deployment guide

Add Docker Compose quick start instructions.
Closes #15
```

### Best Practices

1. **Atomic commits** — Each commit should represent one logical change
2. **Descriptive messages** — Explain *why*, not just *what*
3. **Keep scope focused** — Single responsibility per commit
4. **Use imperative mood** — "add", not "added" or "adds"
5. **Reference issues** — `Closes #123` in footer

## Pull Request Workflow

### Creating a PR

1. Push your branch:
   ```bash
   git push origin feature/user-authentication
   ```

2. Create PR on GitHub with:
   - **Title:** Clear, concise (e.g., "Add JWT token refresh")
   - **Description:** What changed, why, any breaking changes
   - **Linked issues:** Reference `Closes #42`

3. PR checklist:
   - [ ] Tests pass (`pytest`, `pnpm test:e2e`)
   - [ ] Code follows style guide
   - [ ] Documentation updated if needed
   - [ ] No console errors/warnings

### Code Review

- Require at least **1 approval** before merging
- Address feedback and push new commits (don't force-push)
- CI/CD pipeline must pass

### Merging

```bash
# Squash for feature branches (cleaner history)
git merge --squash feature/user-authentication
git commit -m "feat(auth): add JWT token refresh endpoint"

# Or merge with commit for larger features
git merge feature/user-authentication --no-ff
```

After merge, delete the branch:
```bash
git branch -d feature/user-authentication
git push origin --delete feature/user-authentication
```

## Workflow Example

```bash
# 1. Start from main
git checkout main && git pull origin main

# 2. Create feature branch
git checkout -b feature/add-project-filters

# 3. Make changes
echo '# My feature' > feature.txt
git add feature.txt
git commit -m "feat(projects): add status filter to list view"

# 4. Stay updated with main
git fetch origin
git rebase origin/main

# 5. Push and create PR
git push origin feature/add-project-filters
# → Create PR on GitHub

# 6. Address review feedback
# (make edits)
git add .
git commit -m "refactor: improve filter performance"
git push origin feature/add-project-filters

# 7. Merge (via GitHub) and cleanup
git checkout main
git pull origin main
git branch -d feature/add-project-filters
```

## Tags & Releases

```bash
# Create a release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# List tags
git tag -l
```
