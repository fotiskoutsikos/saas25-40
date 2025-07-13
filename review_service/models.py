import uuid
from datetime import datetime
from decimal import Decimal
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID
from enum import Enum

db = SQLAlchemy()

class ReviewStatus(Enum):
    PENDING   = "PENDING"
    ADDRESSED = "ADDRESSED"

class ReviewRequest(db.Model):
    __tablename__ = "review_requests"
    request_id   = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id     = db.Column(UUID(as_uuid=True), nullable=False)
    student_code = db.Column(db.String(20), nullable=False)
    requested_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    reason       = db.Column(db.String(200), nullable=True)
    status       = db.Column(db.Enum(ReviewStatus), nullable=False, default=ReviewStatus.PENDING)

class ReviewResponse(db.Model):
    __tablename__ = "review_responses"
    response_id    = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id     = db.Column(UUID(as_uuid=True),
                                db.ForeignKey("review_requests.request_id"),
                                nullable=False,
                                unique=True)
    instructor_id  = db.Column(UUID(as_uuid=True), nullable=False)
    responded_at   = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    new_grade_value= db.Column(db.Numeric(5,2), nullable=True)
    comments       = db.Column(db.String(200), nullable=True)
