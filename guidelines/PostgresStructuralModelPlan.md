# PostgreSQL Structural Model Plan

## Product goal

prodSQL should help a product manager design and read service data structures visually. The schema model must describe real PostgreSQL structure well enough that tasks, analytics questions, and storage decisions can be discussed from the interface, not only from code.

## Stage 1 scope

Stage 1 adds PostgreSQL table-level structure without changing the Canvas visuals:

- Composite primary keys.
- Composite unique constraints.
- Composite foreign keys.
- Check constraints as SQL expressions.
- Table indexes, including multi-column indexes.
- Backward compatibility with old single-column flags: `isPrimaryKey`, `isUnique`, `isForeignKey`, and `isIndexed`.
- Editing these structures from the right Properties panel.
- Exporting the updated model through JSON and PostgreSQL DDL.

## Why table-level constraints

Single-column flags are convenient for quick editing, but they cannot describe real PostgreSQL structures like `PRIMARY KEY (tenant_id, user_id)` or `UNIQUE (workspace_id, slug)`. PostgreSQL stores these as table constraints, so the app model should do the same. Column flags stay as a fast UI shortcut and are synchronized from the table-level structure.

## UX agreement: fast flags plus detailed entities

The Canvas table and the `Fields` section remain the fastest place to mark common field-level facts: primary key, foreign key, unique, index, and not-null. These controls should stay visible because they make the schema readable for product work.

When a user toggles a field flag, the app should create or update the corresponding detailed entity:

- Primary key, unique, foreign key, and check rules live in `Constraints`.
- Index flags create an `Indexes` entity with the selected field prefilled.
- Not-null is technically a PostgreSQL column constraint, but it stays visible at field level because it describes whether the field is required.

The detailed `Constraints` and `Indexes` sections are then used to refine the generated entity: add more columns, set referential behavior, add index `WHERE`, expression, notes, or other advanced details. This keeps the PM workflow fast while preserving PostgreSQL-accurate structure for export.

## Out of scope for Stage 1

- Canvas visualization changes.
- Migration diff generation.
- Prisma schema generation.
- Advanced PostgreSQL objects such as partitioning, triggers, policies, generated columns, exclusion constraints, storage parameters, and extensions.

## Next stages

Stage 2 can expand relation semantics: referential actions, deferrable constraints, richer index options, and better validation rules. Stage 3 can cover advanced PostgreSQL capabilities only after the core modeling flow is stable.
