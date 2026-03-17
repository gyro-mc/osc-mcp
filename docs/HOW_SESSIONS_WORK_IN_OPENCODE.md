# How Sessions Work In OpenCode

This note summarizes our conversation about how OpenCode assigns sessions to projects (including the `global` project) and how to query the local SQLite DB.

## Version Context

This document is based on the local `opencode.db` schema and session records as of 2026-03-17. Observed OpenCode session versions in the DB: 1.1.53, 1.1.59, 1.2.6, 1.2.10, 1.2.11, 1.2.12, 1.2.15, 1.2.16, 1.2.17, 1.2.24, 1.2.26, 1.2.27.

## Quick Summary

- A session is created when you start an OpenCode instance.
- `session.directory` is set to the real directory you launched from.
- The session’s `project_id` is set at creation time from the resolved project.
- OpenCode searches **upward** from the start directory to find the **nearest `.git`**.
- If a `.git` is found and Git metadata resolves correctly, it uses that repo as the project.
- If no `.git` is found **or** Git metadata fails, the session is assigned to `project_id = global`.
- Later, if a real project is created, any existing global sessions whose `directory` exactly matches the project’s `worktree` are reassigned to that project.

## Decision Tree

```
Start opencode in directory D
│
├─ Look upward for nearest .git
│   │
│   ├─ Found .git
│   │   │
│   │   ├─ Git metadata resolves OK
│   │   │   └─ Use this repo → set project_id to that project
│   │   │
│   │   └─ Git metadata fails
│   │       └─ project_id = global
│   │
│   └─ No .git found
│       └─ project_id = global
│
└─ Later: if a project is created whose worktree == session.directory
    └─ any global sessions with that exact directory get reassigned
```

## Nested Folders and Nested Repos

- If you start inside a subfolder **without its own `.git`**, it uses the parent repo’s project (same project).
- If you start inside a folder that **is itself a Git repo** (nested repo or submodule), it creates/uses a **separate project** for that repo.

## Why `project_id = global` Happens

`project_id = global` is used when the session is not tied to a real project row. This happens when:

1. No `.git` is found anywhere above the start directory.
2. `.git` exists but the `git` binary is not available.
3. Git metadata commands fail (e.g. `git rev-parse --git-common-dir`).
4. The root commit / project ID cannot be resolved.

## SQLite: Common CLI Commands

Open the DB:

```bash
sqlite3 /home/gyro/.local/share/opencode/opencode.db
```

Inside sqlite3:

```sql
.tables
.headers on
.mode column
```

Get sample rows:

```sql
SELECT * FROM project LIMIT 2;
SELECT * FROM session LIMIT 2;
SELECT * FROM message LIMIT 2;
SELECT * FROM part LIMIT 2;
SELECT * FROM todo LIMIT 2;
SELECT * FROM workspace LIMIT 2;
```

Find sessions for a given project by worktree:

```sql
SELECT s.*
FROM session s
JOIN project p ON p.id = s.project_id
WHERE p.worktree = '/home/gyro/Documents/projects/taqni';
```

If your path has a different case or spelling, adjust it exactly to the `project.worktree` value.

## Example: Fixing the Subquery

Incorrect:

```sql
SELECT * FROM session
WHERE project_id =
  SELECT id FROM project
  WHERE worktree = "/home/gyro/Documents/Projects/taqni";
```

Correct (parentheses + single quotes):

```sql
SELECT * FROM session
WHERE project_id = (
  SELECT id FROM project
  WHERE worktree = '/home/gyro/Documents/Projects/taqni'
);
```

If the subquery can return multiple rows:

```sql
SELECT * FROM session
WHERE project_id IN (
  SELECT id FROM project
  WHERE worktree = '/home/gyro/Documents/Projects/taqni'
);
```
