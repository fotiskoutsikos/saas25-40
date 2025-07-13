import uuid
from datetime import datetime
from decimal import Decimal
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID
from flask import Flask

db = SQLAlchemy()

class GradeSheet(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_code = db.Column(db.String(50), nullable=False)
    instructor_id = db.Column(db.String(36), nullable=False)
    is_final = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    year = db.Column(db.Integer, nullable=False)
    exam_type = db.Column(
        db.Enum('Κανονική', 'Επαναληπτική', 'Επι Πτυχίω', name='exam_type_enum'),
        nullable=False
    )

class GradeEntry(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sheet_id = db.Column(db.String(36), db.ForeignKey('grade_sheet.id'), nullable=False)
    student_code = db.Column(db.String(20), nullable=False)
    grade_value = db.Column(db.Float, nullable=False)
    remarks = db.Column(db.String(200), nullable=True)

class GradeStatistics(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sheet_id = db.Column(db.String(36), db.ForeignKey('grade_sheet.id'), nullable=False)
    avg = db.Column(db.Float, nullable=False)
    median = db.Column(db.Float, nullable=False)
    distribution = db.Column(db.JSON, nullable=False)

class Enrollment(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = db.Column(db.String(36), nullable=False)
    course_id = db.Column(db.String(36), nullable=False)

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    institution_id = db.Column(db.Integer, nullable=False)
    instructor_id = db.Column(db.Integer)
    periods = db.Column(db.PickleType, default=["Χειμερινό", "Εαρινό"])

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///data.db'  # ή το δικό σου connection string
app.config['SECRET_KEY'] = 'your_secret_key'  # ή από .env

db.init_app(app)

with app.app_context():
    db.create_all()
