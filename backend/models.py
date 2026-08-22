from typing import Optional, Literal

from pydantic import BaseModel


class Student(BaseModel):
    id: int
    batch_id: str
    name: str
    gender: Optional[str] = None
    grade: Optional[str] = None
    math: Optional[float] = None
    science: Optional[float] = None
    english: Optional[float] = None
    total: Optional[float] = None
    status: Literal["Active", "Debarred"]


class CleaningReport(BaseModel):
    rows_raw: int
    rows_cleaned: int
    duplicates_removed: int
    typos_fixed: int
    values_imputed: int
    rows_dropped: int
    processing_ms: float


class StatusUpdateRequest(BaseModel):
    status: Literal["Active", "Debarred"]


class UploadResponse(BaseModel):
    batch_id: str
    students: list[Student]
    cleaning_report: CleaningReport


class StudentsResponse(BaseModel):
    students: list[Student]
