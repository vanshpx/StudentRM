"""
pytest suite for backend/cleaning.py — 9 focused tests covering all 6 new rules.
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
# Test 1: Strict dedup — removes only fully identical rows (all cols match)
# ---------------------------------------------------------------------------

def test_dedup_removes_only_fully_identical_rows():
    df = _make_df([
        {"name": "Alice Sharma", "gender": "female", "grade": "10", "math": 80, "science": 75, "english": 70, "total": 225},
        {"name": "Alice Sharma", "gender": "female", "grade": "10", "math": 80, "science": 75, "english": 70, "total": 225},  # exact duplicate
        {"name": "alice sharma", "gender": "female", "grade": "10", "math": 90, "science": 85, "english": 80, "total": 255},  # different name casing + scores → kept
    ])
    cleaned, report = run_cleaning_pipeline(df)
    # Row 1 and row 2 normalize to the same key; row 3 normalizes differently (different scores)
    assert report["duplicates_removed"] == 1
    assert len(cleaned) == 2


# ---------------------------------------------------------------------------
# Test 2: Strict dedup keeps first occurrence of the duplicate
# ---------------------------------------------------------------------------

def test_dedup_keeps_first_occurrence():
    df = _make_df([
        {"name": "Bob Kumar", "gender": "male", "grade": "11", "math": 60, "science": 55, "english": 50, "total": 165},
        {"name": "Bob Kumar", "gender": "male", "grade": "11", "math": 60, "science": 55, "english": 50, "total": 165},  # exact dup
    ])
    cleaned, report = run_cleaning_pipeline(df)
    assert len(cleaned) == 1
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
# Test 5: Missing numeric score → is_incomplete=True, value stays None
# ---------------------------------------------------------------------------

def test_missing_score_flagged_incomplete_not_imputed():
    df = _make_df([
        {"name": "Priya R", "gender": "f", "grade": "10", "math": None, "science": 70.0, "english": 65.0, "total": 0},
    ])
    cleaned, report = run_cleaning_pipeline(df)
    row = cleaned.iloc[0]
    # Math must remain null — NOT imputed
    assert pd.isna(row["math"])
    # Row must be flagged incomplete
    assert row["is_incomplete"] == True
    # Total must be null (can't compute without all 3 scores)
    assert pd.isna(row["total"])
    assert report["incomplete_rows"] >= 1


# ---------------------------------------------------------------------------
# Test 6: Total computed only when all 3 scores present; null otherwise
# ---------------------------------------------------------------------------

def test_total_computed_only_when_all_scores_valid():
    df = _make_df([
        # All scores valid → total recomputed
        {"name": "Sneha Patel", "gender": "female", "grade": "10",
         "math": 80, "science": 75, "english": 70, "total": 999},  # 999 should be replaced
        # Missing english → total should be null
        {"name": "Rohan Das", "gender": "male", "grade": "10",
         "math": 80, "science": 75, "english": None, "total": 500},
    ])
    cleaned, _ = run_cleaning_pipeline(df)

    sneha = cleaned[cleaned["name"].str.lower() == "sneha patel"].iloc[0]
    rohan = cleaned[cleaned["name"].str.lower() == "rohan das"].iloc[0]

    assert sneha["total"] == pytest.approx(80 + 75 + 70)
    assert pd.isna(rohan["total"])
    assert rohan["is_incomplete"] == True


# ---------------------------------------------------------------------------
# Test 7: Missing Name → is_incomplete=True, row is KEPT (not dropped)
# ---------------------------------------------------------------------------

def test_row_with_missing_name_kept_and_flagged():
    df = _make_df([
        {"name": "Valid Student", "gender": "m", "grade": "10", "math": 80, "science": 70, "english": 60, "total": 210},
        {"name": None,            "gender": "f", "grade": "10", "math": 90, "science": 85, "english": 80, "total": 255},
        {"name": "",              "gender": "m", "grade": "11", "math": 50, "science": 55, "english": 60, "total": 165},
    ])
    cleaned, report = run_cleaning_pipeline(df)
    # All 3 rows must be kept
    assert len(cleaned) == 3
    # The two nameless rows must be flagged
    assert report["incomplete_rows"] >= 2
    flagged = cleaned[cleaned["is_incomplete"] == True]
    assert len(flagged) >= 2


# ---------------------------------------------------------------------------
# Test 8: Score with text suffix → numeric part extracted
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("raw_score, expected", [
    ("24 marks",  24.0),
    ("85/100",    85.0),
    ("72 pts",    72.0),
    ("90.5marks", 90.5),
    ("65%",       65.0),
])
def test_score_text_suffix_stripped(raw_score, expected):
    df = _make_df([
        {"name": "Test Student", "gender": "f", "grade": "10",
         "math": raw_score, "science": 80, "english": 80, "total": 0}
    ])
    cleaned, _ = run_cleaning_pipeline(df)
    assert cleaned.iloc[0]["math"] == pytest.approx(expected)


# ---------------------------------------------------------------------------
# Test 9: Score > 100 → is_invalid=True
# ---------------------------------------------------------------------------

def test_score_over_100_flagged_invalid():
    df = _make_df([
        {"name": "Over Scorer",  "gender": "m", "grade": "10",
         "math": 150, "science": 75, "english": 70, "total": 295},   # math > 100
        {"name": "Normal Student","gender": "f", "grade": "10",
         "math": 80,  "science": 75, "english": 70, "total": 225},   # all fine
    ])
    cleaned, report = run_cleaning_pipeline(df)

    over = cleaned[cleaned["name"].str.lower().str.contains("over")].iloc[0]
    normal = cleaned[cleaned["name"].str.lower().str.contains("normal")].iloc[0]

    assert over["is_invalid"] == True
    assert normal["is_invalid"] == False
    assert report["invalid_rows"] == 1
