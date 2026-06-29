# main/database

Schema, migrations, repositories. **No business logic.**

The schema lives in `schema/` as versioned SQL files. The migration runner
applies them in order and records progress in a `_schema_version` table.

Phase 0 ships the v1 schema and the runner skeleton; live SQLite CRUD
arrives in Phase 1.
