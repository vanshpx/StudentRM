"""
SQLite repository layer — no ORM, plain sqlite3 with parameterized queries only.
All SQL uses ? placeholders. Never use f-strings to build SQL.
"""

import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "students.db"


def _get_conn() -> sqlite3.Connection:
    """Return a connection with row_factory set so rows behave like dicts."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Create tables if they don't already exist. Called once at app startup."""
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS upload_batches (
                batch_id TEXT PRIMARY KEY,
                filename TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                rows_raw INTEGER,
                rows_cleaned INTEGER,
                duplicates_removed INTEGER,
                typos_fixed INTEGER,
                incomplete_rows INTEGER,
                invalid_rows INTEGER,
                processing_ms REAL
            );

            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL REFERENCES upload_batches(batch_id),
                name TEXT,
                gender TEXT,
                grade TEXT,
                math REAL,
                science REAL,
                english REAL,
                total REAL,
                status TEXT NOT NULL DEFAULT 'Active'
                    CHECK(status IN ('Active','Debarred')),
                is_incomplete INTEGER NOT NULL DEFAULT 0,
                is_invalid INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)


def delete_old_batch() -> None:
    """
    Remove all students and the batch record for the currently active batch.
    Since MVP supports only one batch at a time, we wipe everything.
    """
    with _get_conn() as conn:
        rows = conn.execute("SELECT batch_id FROM upload_batches").fetchall()
        for row in rows:
            conn.execute(
                "DELETE FROM students WHERE batch_id = ?", (row["batch_id"],)
            )
            conn.execute(
                "DELETE FROM upload_batches WHERE batch_id = ?", (row["batch_id"],)
            )


def insert_batch(batch_data: dict) -> None:
    """Insert one row into upload_batches."""
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO upload_batches
                (batch_id, filename, rows_raw, rows_cleaned,
                 duplicates_removed, typos_fixed, incomplete_rows, invalid_rows, processing_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                batch_data["batch_id"],
                batch_data["filename"],
                batch_data["rows_raw"],
                batch_data["rows_cleaned"],
                batch_data["duplicates_removed"],
                batch_data["typos_fixed"],
                batch_data["incomplete_rows"],
                batch_data["invalid_rows"],
                batch_data["processing_ms"],
            ),
        )


def insert_students(students: list[dict]) -> None:
    """Bulk-insert cleaned student rows."""
    if not students:
        return
    with _get_conn() as conn:
        conn.executemany(
            """
            INSERT INTO students
                (batch_id, name, gender, grade, math, science, english, total,
                 status, is_incomplete, is_invalid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    s["batch_id"],
                    s.get("name"),
                    s.get("gender"),
                    s.get("grade"),
                    s.get("math"),
                    s.get("science"),
                    s.get("english"),
                    s.get("total"),
                    s.get("status", "Active"),
                    1 if s.get("is_incomplete") else 0,
                    1 if s.get("is_invalid") else 0,
                )
                for s in students
            ],
        )


def get_active_students() -> list[dict]:
    """Return all students for the current (only) batch, ordered by name."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT s.id, s.batch_id, s.name, s.gender, s.grade,
                   s.math, s.science, s.english, s.total, s.status,
                   s.is_incomplete, s.is_invalid
            FROM students s
            ORDER BY s.name ASC
            """
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["is_incomplete"] = bool(d["is_incomplete"])
        d["is_invalid"] = bool(d["is_invalid"])
        result.append(d)
    return result


def update_student_status(student_id: int, status: str) -> dict:
    """
    Update a single student's status. Returns the updated row.
    Raises ValueError if the student is not found.
    """
    with _get_conn() as conn:
        conn.execute(
            "UPDATE students SET status = ? WHERE id = ?",
            (status, student_id),
        )
        row = conn.execute(
            "SELECT id, status FROM students WHERE id = ?", (student_id,)
        ).fetchone()
    if row is None:
        raise ValueError(f"Student with id={student_id} not found")
    return dict(row)


def get_export_students(min_total: float) -> list[dict]:
    """
    Return Active, complete students whose total >= min_total, for CSV export.
    Excludes is_incomplete rows (they have no valid Total to filter on).
    Server is authoritative for the export — never trust client state.
    """
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT name, gender, grade, math, science, english, total, status
            FROM students
            WHERE status = 'Active'
              AND is_incomplete = 0
              AND total >= ?
            ORDER BY total DESC, name ASC
            """,
            (min_total,),
        ).fetchall()
    return [dict(r) for r in rows]
