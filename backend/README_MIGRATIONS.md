# Database Migrations Guide

## Overview

This project uses [Alembic](https://alembic.sqlalchemy.org/) for database migrations, providing version-controlled schema evolution without data loss.

## Quick Start

### Applying Migrations

To update your database to the latest schema:

```bash
# Set your database URL (bash/zsh)
export DATABASE_URL='postgresql://user:password@localhost/instigpt'

# Apply all pending migrations
poetry run alembic upgrade head
```

**Note for PowerShell users:**
```powershell
$env:DATABASE_URL = 'postgresql://user:password@localhost/instigpt'
poetry run alembic upgrade head
```

### Checking Migration Status

```bash
# View migration history
poetry run alembic history --verbose

# Check current database version
poetry run alembic current
```

## Creating New Migrations

### Auto-generate from Model Changes

When you modify SQLModel classes (add/remove columns, tables, etc.):

```bash
# 1. Make your changes to models in instigpt/db/
# 2. Generate migration automatically
poetry run alembic revision --autogenerate -m "Add user profile picture column"

# 3. Review the generated file in alembic/versions/
# 4. Test the migration
poetry run alembic upgrade head

# 5. Test rollback
poetry run alembic downgrade -1
```

### Manual Migrations

For complex changes or data migrations:

```bash
poetry run alembic revision -m "Migrate user data format"
```

Then edit the generated file with custom `upgrade()` and `downgrade()` logic.

## Migration Workflow

### For Development

1. **Pull latest code**
   ```bash
   git pull origin main
   ```

2. **Apply migrations**
   ```bash
   poetry run alembic upgrade head
   ```

3. **Make schema changes**
   - Edit model files in `instigpt/db/`

4. **Generate migration**
   ```bash
   poetry run alembic revision --autogenerate -m "Description of change"
   ```

5. **Review and test**
   - Check generated file in `alembic/versions/`
   - Verify upgrade works: `alembic upgrade head`
   - Verify downgrade works: `alembic downgrade -1`
   - Re-upgrade: `alembic upgrade head`

6. **Commit changes**
   ```bash
   git add alembic/versions/XXXX_your_migration.py
   git add instigpt/db/your_modified_models.py
   git commit -m "Add migration: Description of change"
   ```

### For Production

1. **Backup database first!**
   ```bash
   pg_dump instigpt > backup_$(date +%Y%m%d).sql
   ```

2. **Apply migrations**
   ```bash
   $env:DATABASE_URL = 'postgresql://prod_user:pass@prod_host/instigpt'
   poetry run alembic upgrade head
   ```

3. **Verify application starts**

4. **Rollback if needed**
   ```bash
   poetry run alembic downgrade -1
   ```

## Common Commands

```bash
# Show current version
alembic current

# Show migration history
alembic history

# Upgrade to specific version
alembic upgrade <revision_id>

# Downgrade to specific version
alembic downgrade <revision_id>

# Downgrade one step
alembic downgrade -1

# Show SQL without executing
alembic upgrade head --sql
```

## Migration File Naming

Migrations are automatically named: `YYYYMMDD_NNNN_description.py`

Example: `20241031_0001_initial_schema.py`

## Best Practices

### DO ✅

- **Always review** auto-generated migrations before committing
- **Test both** `upgrade()` and `downgrade()` functions
- **Keep migrations small** - one logical change per migration
- **Add comments** for complex transformations
- **Backup production** before running migrations
- **Use transactions** for data migrations when possible

### DON'T ❌

- **Don't edit** existing migration files after they're committed
- **Don't skip** migrations in sequence
- **Don't delete** old migration files
- **Don't run** migrations manually in production without backups
- **Don't mix** schema and data changes in the same migration (when possible)

## Troubleshooting

### "Target database is not up to date"

```bash
# Check current version
alembic current

# Check what's pending
alembic history

# Apply missing migrations
alembic upgrade head
```

### "Can't locate revision identified by 'XXXX'"

Migration file is missing. Check:
1. Did you pull latest code?
2. Is the file in `alembic/versions/`?

### "Multiple head revisions"

Branching happened (two people created migrations simultaneously):

```bash
# Merge the heads
alembic merge heads -m "Merge migration branches"
```

### Rollback Failed

If `downgrade()` fails:
1. Check the downgrade logic in the migration file
2. May need to manually fix database state
3. Restore from backup if critical

## Database Support

The migration system supports:
- PostgreSQL (recommended for production)
- SQLite (development/testing)
- MySQL/MariaDB
- Other SQLAlchemy-supported databases

Configure via `DATABASE_URL` environment variable.

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: |
    poetry run alembic upgrade head
```

## Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)

