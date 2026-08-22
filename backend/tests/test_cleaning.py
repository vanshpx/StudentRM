"""
pytest suite for backend/cleaning.py — 7 focused tests.
All tests exercise cleaning rules in isolation.
Run with: pytest backend/tests/ -v
"""

import math
import pandas as pd
import pytest
from backend.cleaning import run_cleaning_pipeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_df(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Test 1: Dedup removes exact normalized duplicates
# ---------------------------------------------------------------------------

def test_dedup_removes_normalized_duplicates():
    df = _make_df([
        {"name": "Alice Sharma", "gender": "female", "grade": "10", "math": 80, "science": 75, "english": 70, "total": 225},
        {"name": "alice sharma",  "gender": "female", "grade": "10", "math": 90, "science": 85, "english": 80, "total": 255},  # duplicate
    ])
    cleaned, report = run_cleaning_pipeline(df)
    assert len(cleaned) == 1
    assert report["duplicates_removed"] == 1


# ---------------------------------------------------------------------------
# Test 2: Dedup keeps first occurrence
# ---------------------------------------------------------------------------

def test_dedup_keeps_first_occurrence():
    df = _make_df([
        {"name": "Bob Kumar", "gender": "male", "grade": "11", "math": 60, "science": 55, "english": 50, "total": 165},
        {"name": "BOB KUMAR", "gender": "male", "grade": "11", "math": 90, "science": 90, "english": 90, "total": 270},  # duplicate
    ])
    cleaned, report = run_cleaning_pipeline(df)
    assert len(cleaned) == 1
    # First occurrence had math=60; recomputed total = 60+55+50 = 165
    assert cleaned.iloc[0]["math"] == 60.0


# ---------------------------------------------------------------------------
# Test 3: Gender typo normalization
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("raw_gender, expected", [
    ("m",      "Male"),
    ("male",   "Male"),
    ("M",      "Male"),
    ("MALE",   "Male"),
    ("f",      "Female"),
    ("female", "Female"),
    ("F",      "Female"),
    ("FEMALE", "Female"),
])
def test_gender_typo_normalization(raw_gender, expected):
    df = _make_df([
        {"name": "Test Student", "gender": raw_gender, "grade": "10",
         "math": 80, "science": 80, "english": 80, "total": 240}
    ])
    cleaned, _ = run_cleaning_pipeline(df)
    assert cleaned.iloc[0]["gender"] == expected


# ---------------------------------------------------------------------------
# Test 4: Grade format normalization
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("raw_grade, expected", [
    ("10th",     "10"),
    ("Grade 10", "10"),
    ("10 ",      "10"),
    ("11th",     "11"),
    ("Grade 12", "12"),
])
def test_grade_format_normalization(raw_grade, expected):
    df = _make_df([
        {"name": "Test Student", "gender": "female", "grade": raw_grade,
         "math": 80, "science": 80, "english": 80, "total": 240}
    ])
    cleaned, _ = run_cleaning_pipeline(df)
    assert cleaned.iloc[0]["grade"] == expected


# ---------------------------------------------------------------------------
# Test 5: Missing numeric value → column median imputed
# ---------------------------------------------------------------------------

def test_missing_numeric_imputed_with_median():
    df = _make_df([
        {"name": "Priya R",    "gender": "f", "grade": "10", "math": 60.0, "science": 70.0, "english": 65.0, "total": 195},
        {"name": "Ravi S",     "gender": "m", "grade": "10", "math": 80.0, "science": 70.0, "english": 65.0, "total": 215},
        {"name": "Kiran T",    "gender": "f", "grade": "10", "math": None,  "science": 70.0, "english": 65.0, "total": 0},   # math missing
    ])
    cleaned, report = run_cleaning_pipeline(df)
    assert report["values_imputed"] >= 1
    # Median of [60, 80] = 70.0
    kiran_row = cleaned[cleaned["name"].str.lower() == "kiran t"]
    assert not kiran_row.empty
    assert kiran_row.iloc[0]["math"] == pytest.approx(70.0)


# ---------------------------------------------------------------------------
# Test 6: Total is always recomputed (never trusted from input)
# ---------------------------------------------------------------------------

def test_total_always_recomputed():
    df = _make_df([
        # Input total is deliberately wrong (999 instead of 225)
        {"name": "Sneha Patel", "gender": "female", "grade": "10",
         "math": 80, "science": 75, "english": 70, "total": 999}
    ])
    cleaned, _ = run_cleaning_pipeline(df)
    expected_total = 80 + 75 + 70
    assert cleaned.iloc[0]["total"] == pytest.approx(expected_total)


# ---------------------------------------------------------------------------
# Test 7: Row with missing Name is dropped and counted
# ---------------------------------------------------------------------------

def test_row_with_missing_name_dropped():
    df = _make_df([
        {"name": "Valid Student", "gender": "m", "grade": "10", "math": 80, "science": 70, "english": 60, "total": 210},
        {"name": None,            "gender": "f", "grade": "10", "math": 90, "science": 85, "english": 80, "total": 255},  # missing name
        {"name": "",              "gender": "m", "grade": "11", "math": 50, "science": 55, "english": 60, "total": 165},  # empty name
    ])
    cleaned, report = run_cleaning_pipeline(df)
    assert len(cleaned) == 1
    assert report["rows_dropped"] == 2
