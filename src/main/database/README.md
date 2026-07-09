# main/database

Schema, migrations, repositories. **No business logic.**

The schema lives in `schema/` as versioned SQL files (`v1.sql`–`v10.sql`).
The migration runner applies them in order and records progress in a
`_schema_version` table; the current schema version is 10.

`StudioDatabase` wraps the native better-sqlite3 driver with
parameterized query helpers (`exec`/`get`/`all`/`execMany`/`transaction`),
runs migrations on open, and selects the correct native binding per runtime
(see `native-binding.ts`). The 29 repositories under `repositories/`
expose domain CRUD on top of it.
