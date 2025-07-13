import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Institution(db.Model):
    __tablename__ = "institutions"
    id              = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name            = db.Column(db.String(120), nullable=False)
    address         = db.Column(db.String(255), nullable=False)  # Increased length to 255
    contact_email   = db.Column(db.String(120), nullable=False, unique=True)
    balance         = db.Column(db.Float, default=0)  # Added balance column

class CreditBalance(db.Model):
    __tablename__ = "credit_balances"
    id                = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id    = db.Column(db.String(36), db.ForeignKey('institutions.id'), nullable=False)
    available_credits = db.Column(db.Integer, nullable=False, default=0)

class Representative(db.Model):
    __tablename__ = "representatives"
    id                = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id    = db.Column(db.String(36), db.ForeignKey('institutions.id'), nullable=False)
    user_id           = db.Column(db.String(36), nullable=False)

class Course(db.Model):
    __tablename__ = "courses"
    id                = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title             = db.Column(db.String(120), nullable=False)
    code              = db.Column(db.String(20), nullable=False, unique=True)
    institution_id    = db.Column(db.String(36), db.ForeignKey('institutions.id'), nullable=False)
    instructor_id     = db.Column(db.String(36), nullable=True)
    periods           = db.Column(db.PickleType, default=list)

class Enrollment(db.Model):
    __tablename__ = "enrollments"
    id                = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id        = db.Column(db.String(36), nullable=False)
    course_id         = db.Column(db.String(36), db.ForeignKey('courses.id'), nullable=False)

class GradeSheet(db.Model):
    __tablename__ = "grade_sheets"
    id                = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id         = db.Column(db.String(36), db.ForeignKey('courses.id'), nullable=False)
    term              = db.Column(db.String(10), nullable=False)

class GradeEntry(db.Model):
    __tablename__ = "grade_entries"
    id                = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sheet_id          = db.Column(db.String(36), db.ForeignKey('grade_sheets.id'), nullable=False)
    student_code      = db.Column(db.String(36), nullable=False)
    grade_value       = db.Column(db.Float, nullable=False)
    remarks            = db.Column(db.String(200), nullable=True)
