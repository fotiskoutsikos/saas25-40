from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
from dotenv import load_dotenv
import jwt
import os
import pandas as pd
import datetime
import uuid
import requests
import re
import json
from models import db, GradeSheet, GradeEntry, GradeStatistics, Enrollment, Course
import sys
from datetime import datetime

# Load environment variables from .env
load_dotenv()

# Initialize Flask app and SQLAlchemy
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///data.db')
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET', 'your_secret_key')
db.init_app(app)

# Create all tables on first request
with app.app_context():
    db.create_all()

# JWT token decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"message": "Token is missing or invalid!"}), 401
        token = auth_header.split(" ")[1]
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = {"id": data["id"], "role": data["role"]}
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired!"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token!"}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Roles required decorator
def roles_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(current_user, *args, **kwargs):
            if current_user["role"] not in roles:
                return jsonify({"message": "You do not have permission to access this resource!"}), 403
            return f(current_user, *args, **kwargs)
        return decorated
    return decorator

# Utility: Parse Excel file
def parse_excel(file):
    try:
        df = pd.read_excel(file)
        if not {'student_code', 'grade_value', 'remarks'}.issubset(df.columns):
            raise ValueError("Invalid Excel format. Missing required headers.")
        return df
    except Exception as e:
        raise ValueError(f"Error parsing Excel file: {str(e)}")

# Compute statistics
def compute_statistics(df):
    # Έλεγχος για τιμές εκτός ορίων
    if (df['grade_value'] < 0).any() or (df['grade_value'] > 10).any():
        raise ValueError("Grades must be between 0 and 10")
    avg = df['grade_value'].mean()
    median = df['grade_value'].median()
    # Πάντα 0-10
    distribution = {i: 0 for i in range(11)}
    value_counts = df['grade_value'].value_counts().to_dict()
    for k, v in value_counts.items():
        distribution[int(k)] = v
    return {"avg": avg, "median": median, "distribution": distribution}

# Compute statistics (analytical version)
def compute_statistics_analytical(df):
    # Βρες όλα τα Q columns (Q1, Q2, ...)
    q_columns = [col for col in df.columns if col.startswith("Q")]
    w_columns = [col for col in df.columns if re.match(r"W\d+", str(col))]
    # Πάρε τα βάρη (αν υπάρχουν)
    weights = []
    if w_columns:
        weights = [float(df[w].iloc[0]) for w in w_columns]
    else:
        weights = [1.0 for _ in q_columns]  # αν δεν υπάρχουν βάρη, όλα 1

    # Υπολόγισε συνολική βαθμολογία για κάθε γραμμή
    if q_columns and weights and len(q_columns) == len(weights):
        df['total_grade'] = df[q_columns].astype(float).dot(weights) / sum(weights)
    else:
        df['total_grade'] = df['Βαθμολογία'] if 'Βαθμολογία' in df.columns else 0

    # Συνολικά στατιστικά (όπως πριν)
    overall_stats = compute_statistics(df.rename(columns={'total_grade': 'grade_value'}))

    # Για κάθε ερώτημα Qn, υπολόγισε στατιστικά
    questions_stats = {}
    for i, q in enumerate(q_columns):
        q_df = df[[q]].rename(columns={q: 'grade_value'}).dropna()
        questions_stats[q] = compute_statistics(q_df)

    return {
        "overall_stats": overall_stats,
        "questions_stats": questions_stats,
        "weights": dict(zip(q_columns, weights))
    }

# Endpoints
@app.route('/grades/initial', methods=['POST'])
@token_required
@roles_required("INSTRUCTOR")
def create_initial_grades(current_user):
    if 'file' not in request.files or not request.form.get('course_code') or not request.form.get('instructor_id'):
        return jsonify({"message": "Missing required fields"}), 400

    file = request.files['file']
    course_code = request.form['course_code']
    instructor_id = request.form['instructor_id']
    institution_id = request.form['institution_id']
    year= request.form['year']
    exam_type = request.form['exam_type']


    required_headers = {'Αριθμός Μητρώου', 'Βαθμολογία'}

    try:
        # preview first rows
        preview = pd.read_excel(file, header=None, nrows=20)
        header_row = None
        for i, row in preview.iterrows():
            vals = set(map(str, row.values))
            if required_headers.issubset(vals):
                header_row = i
                break
        if header_row is None:
            return jsonify({"message": "Invalid Excel format."}), 400

        # reset stream and read with correct header
        file.stream.seek(0)
        df = pd.read_excel(file, header=header_row)

        missing = required_headers - set(df.columns)
        if missing:
            return jsonify({"message": f"Invalid Excel format. Missing headers: {list(missing)}"}), 400

        codes = df['Αριθμός Μητρώου']
        values = df['Βαθμολογία']

    except Exception as e:
        return jsonify({"message": f"Error processing Excel file: {e}"}), 400

    # create sheet
    sheet = GradeSheet(course_code=course_code, instructor_id=instructor_id, is_final=False,year=year, exam_type=exam_type)
    db.session.add(sheet)
    db.session.commit()

    # create entries
    entries = [
        GradeEntry(sheet_id=sheet.id, student_code=str(c).zfill(8), grade_value=float(v))
        for c, v in zip(codes, values)
    ]
    db.session.bulk_save_objects(entries)
    db.session.commit()

    # compute & store stats
    df_clean = df.rename(columns={
        'Αριθμός Μητρώου': 'student_code',
        'Βαθμολογία':     'grade_value'
    })
    stats = compute_statistics(df_clean)
    gs = GradeStatistics(
        sheet_id=sheet.id,
        avg=stats['avg'],
        median=stats['median'],
        distribution=stats['distribution']
    )
    db.session.add(gs)
    db.session.commit()

    return jsonify({
        "sheet_id":    sheet.id,
        "entry_count": len(entries),
        "stats":       stats
    }), 201


@app.route('/grades/final', methods=['POST'])
@token_required
@roles_required("INSTRUCTOR")
def create_final_grades(current_user):
    if 'file' not in request.files or not request.form.get('course_code') or not request.form.get('instructor_id'):
        return jsonify({"message": "Missing required fields"}), 400

    file = request.files['file']
    course_code = request.form['course_code']
    instructor_id = request.form['instructor_id']
    institution_id = request.form['institution_id']
    year= request.form['year']
    exam_type = request.form['exam_type']

    required_headers = {'Αριθμός Μητρώου', 'Βαθμολογία'}

    try:
        preview = pd.read_excel(file, header=None, nrows=20)
        header_row = None
        for i, row in preview.iterrows():
            vals = set(map(str, row.values))
            if required_headers.issubset(vals):
                header_row = i
                break
        if header_row is None:
            return jsonify({"message": "Invalid Excel format. Missing Greek headers."}), 400

        file.stream.seek(0)
        df = pd.read_excel(file, header=header_row)

        # --- ΝΕΟ: Υποστήριξη και "Βαθμολογιες" ---
        if 'Βαθμολογία' not in df.columns and 'Βαθμολογίες' in df.columns:
            df = df.rename(columns={'Βαθμολογίες': 'Βαθμολογία'})
        # ----------------------------------------

        missing = required_headers - set(df.columns)
        if missing:
            return jsonify({"message": f"Invalid Excel format. Missing headers: {list(missing)}"}), 400

        # Βρες αν υπάρχουν Q-columns
        q_columns = [col for col in df.columns if str(col).startswith("Q")]
    except Exception as e:
        return jsonify({"message": f"Error processing Excel file: {e}"}), 400

    # find or create final sheet
    sheet = GradeSheet.query.filter_by(
        course_code=course_code, instructor_id=instructor_id, is_final=True,year=year, exam_type=exam_type
    ).first()
    if sheet:
        GradeEntry.query.filter_by(sheet_id=sheet.id).delete()
        GradeStatistics.query.filter_by(sheet_id=sheet.id).delete()
        # Ενημέρωσε το created_at με τώρα
        sheet.created_at = datetime.utcnow()
        db.session.commit()
    else:
        sheet = GradeSheet(
            course_code=course_code,
            instructor_id=instructor_id,
            is_final=True,
            year=year,
            exam_type=exam_type
        )
        db.session.add(sheet)
        db.session.commit()
            

    # Δημιούργησε GradeEntry για κάθε φοιτητή
    entries = []
    for idx, row in df.iterrows():
        student_code = str(row['Αριθμός Μητρώου']).zfill(8)
        # ΠΑΝΤΑ πάρε το συνολικό βαθμό από τη στήλη "Βαθμολογία"
        grade_value = float(row['Βαθμολογία'])
        remarks = None
        # Αν υπάρχουν Q-columns, αποθήκευσέ τες στα remarks
        if q_columns:
            q_scores = {q: row[q] for q in q_columns if pd.notnull(row[q])}
            if q_scores:
                remarks = json.dumps(q_scores, ensure_ascii=False)
        entry = GradeEntry(
            sheet_id=sheet.id,
            student_code=student_code,
            grade_value=grade_value,  # <-- ΕΔΩ ο συνολικός βαθμός
            remarks=remarks           # <-- ΕΔΩ τα Q-columns (αν υπάρχουν)
        )
        entries.append(entry)
    db.session.bulk_save_objects(entries)
    db.session.commit()

    # compute & store stats
    df_clean = df.rename(columns={
        'Αριθμός Μητρώου': 'student_code',
        'Βαθμολογία':     'grade_value'
    })
    stats = compute_statistics(df_clean)
    gs = GradeStatistics(
        sheet_id=sheet.id,
        avg=stats['avg'],
        median=stats['median'],
        distribution=stats['distribution']
    )
    db.session.add(gs)
    db.session.commit()

    # Deduct 1 credit via institution_service
    inst_base = os.getenv("INSTITUTION_SERVICE_URL", "http://institution_service:8002")
    deduct_url = f"{inst_base}/institutions/{institution_id}/balance/deduct"
    resp = requests.post(
        deduct_url,
        json={"amount": 1},
        headers={"Authorization": request.headers.get("Authorization")}
    )
    if resp.status_code != 200:
        return jsonify({"message": "Failed to deduct credit"}), 400

    return jsonify({
        "sheet_id":    sheet.id,
        "entry_count": len(entries),
        "stats":       stats
    }), 201

@app.route('/grades/sheet/<sheet_id>', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR", "STUDENT")
def get_sheet(current_user, sheet_id):
    sheet = GradeSheet.query.get(sheet_id)
    if not sheet:
        return jsonify({"message": "Sheet not found"}), 404

    entries = GradeEntry.query.filter_by(sheet_id=sheet.id).all()
    stats = GradeStatistics.query.filter_by(sheet_id=sheet.id).first()

    return jsonify({
        "sheet_id": sheet.id,
        "course_code": sheet.course_code,
        "instructor_id": sheet.instructor_id,
        "is_final": sheet.is_final,
        "year":sheet.year,
        "exam_type": sheet.exam_type,
        "entries": [{"student_code": e.student_code, "grade_value": e.remarks} for e in entries],
        "stats": {"avg": stats.avg, "median": stats.median, "distribution": stats.distribution}
    }), 200

@app.route('/grades/stats/<course_code>', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR", "STUDENT", "INSTITUTION_REP")
def get_course_stats(current_user, course_code):
    year = request.args.get('year', type=int)
    exam_type = request.args.get('exam_type')

    if not year or not exam_type:
        return jsonify({"message": "Missing year or exam_type"}), 400
    
    # Βρες το πιο πρόσφατο τελικό sheet
    sheet = GradeSheet.query.filter_by(course_code=course_code, is_final=True,year=year, exam_type=exam_type).order_by(GradeSheet.id.desc()).first()
    if not sheet:
        return jsonify({"message": "No final sheet found for this course"}), 404

    # Πάρε τα αποθηκευμένα overall στατιστικά από τη βάση
    stats = GradeStatistics.query.filter_by(sheet_id=sheet.id).first()
    if not stats:
        return jsonify({"message": "No statistics found"}), 404

    # Πάρε όλα τα GradeEntry για το sheet για να υπολογίσεις τα per-question στατιστικά
    entries = GradeEntry.query.filter_by(sheet_id=sheet.id).all()
    import json
    all_entries = []
    for e in entries:
        row = {"Αριθμός Μητρώου": e.student_code, "Βαθμολογία": e.grade_value}
        if e.remarks:
            try:
                row.update(json.loads(e.remarks))
            except Exception:
                pass
        all_entries.append(row)

    import pandas as pd
    df = pd.DataFrame(all_entries)
    questions_stats = {}
    if not df.empty:
        q_columns = [col for col in df.columns if str(col).startswith("Q")]
        for q in q_columns:
            q_df = df[[q]].rename(columns={q: 'grade_value'}).dropna()
            questions_stats[q] = compute_statistics(q_df)

    return jsonify({
        "course_code": course_code,
        "overall_stats": {
            "avg": stats.avg,
            "median": stats.median,
            "distribution": stats.distribution
        },
        "questions_stats": questions_stats
    }), 200

@app.route('/student/enroll', methods=['POST'])
@token_required
@roles_required("STUDENT")
def enroll_course(current_user):
    data = request.get_json()
    course_id = data.get('course_id')
    if not course_id:
        return jsonify({"message": "Course ID required"}), 400
    # Check if already enrolled
    if Enrollment.query.filter_by(student_id=current_user["id"], course_id=course_id).first():
        return jsonify({"message": "Already enrolled"}), 400
    enrollment = Enrollment(student_id=current_user["id"], course_id=course_id)
    db.session.add(enrollment)
    db.session.commit()
    return jsonify({"message": "Enrolled successfully"}), 201

@app.route('/student/unenroll', methods=['POST'])
@token_required
@roles_required("STUDENT")
def unenroll_course(current_user):
    data = request.get_json()
    course_id = data.get('course_id')
    if not course_id:
        return jsonify({"message": "Course ID required"}), 400
    enrollment = Enrollment.query.filter_by(student_id=current_user["id"], course_id=course_id).first()
    if not enrollment:
        return jsonify({"message": "Not enrolled in this course"}), 400
    db.session.delete(enrollment)
    db.session.commit()
    return jsonify({"message": "Unenrolled successfully"}), 200

@app.route('/student/courses', methods=['GET'])
@token_required
@roles_required("STUDENT")
def get_student_courses(current_user):
    print("HEADERS:", dict(request.headers), file=sys.stderr)
    print("current_user:", current_user, file=sys.stderr)
    enrollments = Enrollment.query.filter_by(student_id=current_user["id"]).all()
    print("enrollments:", enrollments, file=sys.stderr)
    return jsonify([e.course_id for e in enrollments]), 200

@app.route('/student/grades', methods=['GET'])
@token_required
@roles_required("STUDENT")
def get_student_grades(current_user):
    print("current_user:", current_user, file=sys.stderr)
    student_code = get_student_code(current_user["id"])
    print("student_code from user_service:", student_code, file=sys.stderr)
    if not student_code:
        return jsonify({"message": "Student code not found"}), 404

    # Φέρε όλα τα entries του φοιτητή μαζί με τα sheets τους
    entries = (
        db.session.query(GradeEntry, GradeSheet)
        .join(GradeSheet, GradeEntry.sheet_id == GradeSheet.id)
        .filter(GradeEntry.student_code == student_code)
        .all()
    )

    # Ομαδοποίησε ανά (course_code, year, exam_type)
    grouped = {}
    for entry, sheet in entries:
        key = (sheet.course_code, sheet.year, sheet.exam_type)
        # Αν δεν υπάρχει το key ή αν το νέο είναι final, κράτα το final
        if key not in grouped or (sheet.is_final and not grouped[key][1].is_final):
            grouped[key] = (entry, sheet)

    result = []
    for entry, sheet in grouped.values():
        result.append({
            "entry_id": entry.id,
            "course_code": sheet.course_code,
            "year": sheet.year,
            "exam_type": sheet.exam_type,
            "grade_value": entry.grade_value,
            "grade_status": "closed" if sheet.is_final else "open",
            "is_final": sheet.is_final,
            "remarks": entry.remarks
        })
    print("Result to return:", result, file=sys.stderr)
    return jsonify(result), 200

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/enrollments', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR", "INSTITUTION_REP")
def get_all_enrollments(current_user):
    enrollments = Enrollment.query.all()
    return jsonify([{
        "student_id": e.student_id,
        "course_id": e.course_id
    } for e in enrollments]), 200

@app.route('/course/<course_code>/students', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR")
def get_students_for_course(current_user, course_code):
    sheets = GradeSheet.query.filter_by(course_code=course_code, instructor_id=current_user["id"],year=year, exam_type=exam_type).all()
    student_ids = set()
    for sheet in sheets:
        entries = GradeEntry.query.filter_by(sheet_id=sheet.id).all()
        student_ids.update([e.student_code for e in entries])
    return jsonify(list(student_ids)), 200

@app.route('/courses', methods=['POST'])
@token_required
@roles_required("INSTITUTION_REP", "INSTRUCTOR")
def create_course(current_user):
    data = request.get_json()
    # Έλεγξε αν υπάρχει ήδη course με αυτό το code
    if Course.query.filter_by(code=data['code']).first():
        return jsonify({"message": "Course already exists"}), 400
    course = Course(
        title=data['title'],
        code=data['code'],
        institution_id=data['institution_id'],
        instructor_id=data.get('instructor_id'),
        periods=data.get('periods', ["Χειμερινό", "Εαρινό"])
    )
    db.session.add(course)
    db.session.commit()
    return jsonify({
        "id": course.id,
        "title": course.title,
        "code": course.code,
        "institution_id": course.institution_id,
        "instructor_id": course.instructor_id,
        "periods": course.periods
    }), 201

@app.route('/courses', methods=['GET'])
@token_required
def get_courses(current_user):
    courses = Course.query.all()
    return jsonify([
        {
            "id": c.id,
            "title": c.title,
            "code": c.code,
            "institution_id": c.institution_id,
            "instructor_id": c.instructor_id,
            "periods": c.periods if hasattr(c, "periods") and c.periods else ["Χειμερινό", "Εαρινό"]
        }
        for c in courses
    ]), 200


@app.route('/grades/initial/<course_code>', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR")
def get_initial_sheets_for_course(current_user, course_code):
    sheets = GradeSheet.query.filter_by(course_code=course_code, is_final=False).all()
    if not sheets:
        return jsonify([]), 200  # Empty array is fine

    return jsonify([
        {
            "sheet_id": sheet.id,
            "year": sheet.year,
            "exam_type": sheet.exam_type,
            "created_at": getattr(sheet, "created_at", None)
        }
        for sheet in sheets
    ]), 200


@app.route('/grades/final/<course_code>', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR")
def get_final_sheets_for_course(current_user, course_code):
    sheets = GradeSheet.query.filter_by(course_code=course_code, is_final=True).all()
    if not sheets:
        return jsonify([]), 200

    return jsonify([
        {
            "sheet_id": sheet.id,
            "year": sheet.year,
            "exam_type": sheet.exam_type,
            "created_at": getattr(sheet, "created_at", None)
        }
        for sheet in sheets
    ]), 200


def get_student_code(user_id):
    USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user_service:8001")
    # Πάρε το Authorization header από το αρχικό request
    auth_header = request.headers.get("Authorization")
    headers = {}
    if auth_header:
        headers["Authorization"] = auth_header
    resp = requests.get(f"{USER_SERVICE_URL}/users/{user_id}", headers=headers)
    if resp.status_code == 200:
        return resp.json().get("student_code")
    return None

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8004))
    app.run(host="0.0.0.0", port=port)
