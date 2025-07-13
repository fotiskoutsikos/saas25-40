import uuid
from datetime import datetime, timedelta
from sqlalchemy.dialects.postgresql import UUID
from flask_sqlalchemy import SQLAlchemy
from enum import Enum

db = SQLAlchemy()

class UserRole(Enum):
    STUDENT = "STUDENT"
    INSTRUCTOR = "INSTRUCTOR"
    INSTITUTION_REP = "INSTITUTION_REP"


class User(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), nullable=False, unique=True)
    email = db.Column(db.String(120), nullable=False, unique=True)
    password = db.Column(db.String(128), nullable=False)
    student_code = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(20), nullable=False, default="STUDENT")
    institution_id = db.Column(db.String(36), nullable=True)


    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "student_code": self.student_code,
            "role": self.role,
            "institution_id": self.institution_id
        }

class SessionToken(db.Model):
    __tablename__ = "session_tokens"
    token     = db.Column(db.String(128), primary_key=True)
    user_id   = db.Column(UUID(as_uuid=True), db.ForeignKey("users.user_id"), nullable=False)
    expires_at= db.Column(db.DateTime, nullable=False, default=lambda: datetime.utcnow() + timedelta(hours=2))

    def is_valid(self):
        return datetime.utcnow() < self.expires_at
