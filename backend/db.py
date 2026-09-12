"""
Database setup — SQLAlchemy over SQLite.

Mirrors Value Stream's / Conway's Depot's db.py conventions: a module-level `db` object,
`init_db(app)` that creates tables then runs additive migrations, and a pragma listener
enabling foreign keys + WAL mode. No Alembic — additive-only migrations in `_MIGRATIONS`.
"""

import os
import uuid

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event, inspect, text

db = SQLAlchemy()


def _uuid() -> str:
    return str(uuid.uuid4())


def get_db_path(app) -> str:
    data_dir = os.environ.get("DATA_DIR", os.path.join(app.root_path, "..", "data"))
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "thefixer.db")


def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


# (table_name, column_name, add_column_sql) — additive-only, run after create_all(). No legacy
# data to worry about yet; revisit only if a destructive change is ever needed.
_MIGRATIONS: list[tuple[str, str, str]] = []


def _run_migrations(app):
    with app.app_context():
        inspector = inspect(db.engine)
        existing_tables = set(inspector.get_table_names())
        with db.engine.begin() as conn:
            for table_name, col_name, alter_sql in _MIGRATIONS:
                if table_name not in existing_tables:
                    continue
                cols = {c["name"] for c in inspector.get_columns(table_name)}
                if col_name not in cols:
                    conn.execute(text(alter_sql))


def init_db(app):
    db_path = get_db_path(app)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        event.listen(db.engine, "connect", _set_sqlite_pragma)
        db.create_all()

    _run_migrations(app)
