from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from functools import wraps
from dotenv import load_dotenv
import jwt
import datetime
import os
import uuid
import requests
from models import db, Institution, CreditBalance, Representative, Course, Enrollment, GradeSheet, GradeEntry

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
            current_user = {"id": data["id"], "role": data["role"], "institution_id": data["institution_id"]}
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

# Endpoints
@app.route('/institutions', methods=['POST'])
@token_required
@roles_required("INSTITUTION_REP", "ADMIN")
def create_institution(current_user):
    data = request.get_json()
    new_inst = Institution(
        id=data.get("id"),
        name=data["name"],
        address=data["address"],
        contact_email=data["contact_email"]
    )
    db.session.add(new_inst)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "The name or email are already taken"}), 400

    return jsonify({
        "id": new_inst.id,
        "name": new_inst.name,
        "address": new_inst.address,
        "contact_email": new_inst.contact_email
    }), 201

@app.route('/institutions', methods=['GET'])
@token_required
@roles_required("INSTITUTION_REP", "INSTRUCTOR")
def get_institutions(current_user):
    institutions = Institution.query.all()
    if not institutions:
        return jsonify({"message": "No institutions found"}), 404

    result = []
    for institution in institutions:
        balance = CreditBalance.query.filter_by(institution_id=institution.id).first()
        result.append({
            "id": institution.id,
            "name": institution.name,
            "address": institution.address,
            "contact_email": institution.contact_email,
            "available_credits": balance.available_credits if balance else 0
        })

    return jsonify(result), 200

@app.route('/institutions/public', methods=['GET'])
def get_institutions_public():
    institutions = Institution.query.all()
    result = []
    for institution in institutions:
        balance = CreditBalance.query.filter_by(institution_id=institution.id).first()
        result.append({
            "id": institution.id,
            "name": institution.name,
            "address": institution.address,
            "contact_email": institution.contact_email,
            "available_credits": balance.available_credits if balance else 0
        })
    return jsonify(result), 200

@app.route('/institutions/<institution_id>', methods=['GET'])
@token_required
@roles_required("INSTITUTION_REP", "INSTRUCTOR")
def get_institution(current_user):
    # changed to get inst id
    institution = Institution.query.get(current_user["institution_id"])
    if not institution:
        return jsonify({"message": "Institution not found"}), 404

    balance = CreditBalance.query.filter_by(institution_id=current_user["institution_id"]).first()
    return jsonify({
        "id": institution.id,
        "name": institution.name,
        "address": institution.address,
        "contact_email": institution.contact_email,
        "available_credits": balance.available_credits if balance else 0
    }), 200

@app.route('/institutions/<institution_id>', methods=['PUT'])
@token_required
@roles_required("INSTITUTION_REP")
def update_institution(current_user):

    institution = Institution.query.get(current_user["institution_id"])
    if not institution:
        return jsonify({"message": "Institution not found"}), 404

    data = request.get_json()
    institution.name = data.get('name', institution.name)
    institution.address = data.get('address', institution.address)
    institution.contact_email = data.get('contact_email', institution.contact_email)
    db.session.commit()

    return jsonify({
        "id": institution.id,
        "name": institution.name,
        "address": institution.address,
        "contact_email": institution.contact_email
    }), 200

@app.route('/institutions/<institution_id>/balance/add', methods=['POST'])
@token_required
@roles_required("INSTITUTION_REP")
def add_balance(current_user, institution_id):
    data = request.get_json()
    amount = float(data.get('amount', 0))
    institution = Institution.query.get(institution_id)
    if not institution:
        return jsonify({"message": "Institution not found"}), 404
    institution.balance += amount
    db.session.commit()
    return jsonify({"message": "Balance updated", "balance": institution.balance}), 200

@app.route('/institutions/<institution_id>/balance/deduct', methods=['POST'])
@token_required
@roles_required("INSTITUTION_REP", "INSTRUCTOR")
def deduct_balance(current_user, institution_id):
    # Έλεγχοι για rep/instructor
    if current_user["role"] == "INSTITUTION_REP":
        if institution_id != current_user["institution_id"]:
            return jsonify({"message": "Unauthorized: institution_id mismatch"}), 403
    elif current_user["role"] == "INSTRUCTOR":
        teaches = Course.query.filter_by(instructor_id=current_user["id"], institution_id=institution_id).first()
        if not teaches:
            return jsonify({"message": "Unauthorized: not instructor of this institution"}), 403

    data = request.get_json()
    amount = float(data.get('amount', 0))
    institution = Institution.query.get(institution_id)
    if not institution:
        return jsonify({"message": "Institution not found"}), 404
    if institution.balance < amount:
        return jsonify({"message": "Not enough credits"}), 400
    institution.balance -= amount
    db.session.commit()
    return jsonify({"balance": institution.balance}), 200

@app.route('/institutions/<institution_id>/representatives', methods=['POST'])
@token_required
@roles_required("INSTITUTION_REP")
# here we keep inst id from url cause its the first time we associate with an institution
def add_representative(current_user, institution_id):
    data = request.get_json()
    new_representative = Representative(
        institution_id=institution_id,
        user_id=data['user_id']
    )
    db.session.add(new_representative)
    db.session.commit()
    # Update user's institution_id in user service
    try:
        user_service_url = f"http://user_service:8001/users/{data['user_id']}"
        resp = requests.put(
            user_service_url,
            headers={
                "Authorization": request.headers.get("Authorization"),
                "Content-Type": "application/json"
            },
            json={"institution_id": institution_id}
        )
        if resp.status_code != 200:
            print("Warning: Failed to persist institution_id in user service:", resp.text)
    except Exception as e:
        print("Error calling user service to update institution_id:", e)


    return jsonify({
        "id": new_representative.id,
        "institution_id": new_representative.institution_id,
        "user_id": new_representative.user_id
    }), 201

@app.route('/institutions/<institution_id>/representatives', methods=['GET'])
@token_required
@roles_required("INSTITUTION_REP")
def get_representatives(current_user):
    representatives = Representative.query.filter_by(institution_id=current_user["institution_id"]).all()
    if not representatives:
        return jsonify({"message": "No representatives found"}), 404

    return jsonify([{
        "id": rep.id,
        "institution_id": rep.institution_id,
        "user_id": rep.user_id
    } for rep in representatives]), 200

@app.route('/representatives/<user_id>', methods=['GET'])
def get_representative_by_user(user_id):
    rep = Representative.query.filter_by(user_id=user_id).first()
    if not rep:
        return jsonify({"message": "Representative not found"}), 404
    return jsonify({"institution_id": rep.institution_id}), 200

@app.route('/courses', methods=['GET'])
@token_required
def get_courses(current_user):
    courses = Course.query.all()
    return jsonify([{
        "id": c.id,
        "title": c.title,
        "code": c.code,
        "institution_id": c.institution_id,
        "instructor_id": c.instructor_id
    } for c in courses]), 200

@app.route('/courses', methods=['POST'])
@token_required
@roles_required("INSTITUTION_REP")
def create_course(current_user):
    data = request.get_json()
    course = Course(
        title=data['title'],
        code=data['code'],
        institution_id=current_user["institution_id"], ## changed 
                                    ## so rep can only create courses on his own inst
        instructor_id=data.get('instructor_id'),
        periods=data.get('periods', ["Χειμερινό", "Εαρινό"])
    )
    db.session.add(course)
    db.session.commit()

    # --- ΝΕΟ: Δημιουργία course και στο grading_service ---
    try:
        grading_url = "http://grading_service:8004/courses"  # άλλαξε το port αν χρειάζεται
        grading_payload = {
            "title": course.title,
            "code": course.code,
            "institution_id": course.institution_id,
            "instructor_id": course.instructor_id,
            "periods": course.periods
        }
        headers = {
            "Authorization": request.headers.get("Authorization"),
            "Content-Type": "application/json"
        }
        resp = requests.post(grading_url, json=grading_payload, headers=headers, timeout=5)
        # Optional: έλεγξε αν απέτυχε
        if resp.status_code not in (200, 201):
            print("Warning: Could not create course in grading_service:", resp.text)
    except Exception as e:
        print("Error creating course in grading_service:", e)
    # ------------------------------------------------------

    return jsonify({
        "id": course.id,
        "title": course.title,
        "code": course.code,
        "institution_id": course.institution_id,
        "instructor_id": course.instructor_id
    }), 201

@app.route('/student/enroll', methods=['POST'])
@token_required
@roles_required("STUDENT")
def enroll_course(current_user):
    data = request.get_json()
    course_id = data.get('course_id')
    if not course_id:
        return jsonify({"message": "Course ID required"}), 400
    existing_enrollment = Enrollment.query.filter_by(student_id=current_user["id"], course_id=course_id).first()
    if existing_enrollment:
        return jsonify({"message": "Already enrolled in this course"}), 400
    enrollment = Enrollment(
        student_id=current_user["id"],
        course_id=course_id
    )
    db.session.add(enrollment)
    db.session.commit()

    # Internal call to grading_service
    try:
        grading_url = "http://grading_service:8004/student/enroll"  # ή localhost:8004 αν τρέχεις τοπικά
        headers = {
            "Authorization": request.headers.get("Authorization"),
            "Content-Type": "application/json"
        }
        resp = requests.post(grading_url, json={"course_id": course_id}, headers=headers, timeout=5)
        if resp.status_code != 201:
            return jsonify({"message": "Enrolled locally, but failed to sync with grading service", "grading_response": resp.text}), 207
    except Exception as e:
        return jsonify({"message": "Enrolled locally, but failed to sync with grading service", "error": str(e)}), 207

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

@app.route('/enrollments', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR", "INSTITUTION_REP")
def get_all_enrollments(current_user):
    enrollments = Enrollment.query.all()
    return jsonify([{
        "student_id": e.student_id,
        "course_id": e.course_id
    } for e in enrollments]), 200

@app.route('/student/grades/<course_code>', methods=['GET'])
@token_required
@roles_required("STUDENT")
def get_grade_for_course(current_user, course_code):
    entries = GradeEntry.query.join(GradeSheet, GradeEntry.sheet_id == GradeSheet.id)\
        .filter(GradeEntry.student_code == current_user["id"], GradeSheet.course_code == course_code).all()
    return jsonify([{
        "grade_value": e.grade_value,
        "remarks": e.remarks
    } for e in entries]), 200

@app.route('/courses/available', methods=['GET'])
@token_required
@roles_required("STUDENT")
def get_available_courses(current_user):
    # Βρες τα course_ids στα οποία είναι ήδη εγγεγραμμένος ο φοιτητής
    enrolled = Enrollment.query.filter_by(student_id=current_user["id"]).with_entities(Enrollment.course_id).all()
    enrolled_ids = [e.course_id for e in enrolled]
    # Βρες όλα τα μαθήματα στα οποία ΔΕΝ είναι εγγεγραμμένος
    courses = Course.query.filter(~Course.id.in_(enrolled_ids)).all()
    return jsonify([{
        "id": c.id,
        "title": c.title,
        "code": c.code,
        "institution_id": c.institution_id,
        "instructor_id": c.instructor_id
    } for c in courses]), 200

@app.route('/instructor/courses', methods=['GET'])
@token_required
@roles_required("INSTRUCTOR")
def get_instructor_courses(current_user):
    courses = Course.query.filter_by(instructor_id=current_user["id"]).all()
    return jsonify([{
        "id": c.id,
        "title": c.title,
        "code": c.code,
        "institution_id": c.institution_id,
        "instructor_id": c.instructor_id,
        "periods": c.periods if hasattr(c, "periods") and c.periods else ["Χειμερινό", "Εαρινό"]
    } for c in courses]), 200

@app.route('/institution/courses', methods=['GET'])
@token_required
@roles_required("STUDENT", "INSTRUCTOR", "INSTITUTION_REP")
def get_institution_courses(current_user):
    institution_id = current_user.get("institution_id")
    if not institution_id:
        # Βρες το institution από το πρώτο course που είναι εγγεγραμμένος ο φοιτητής
        enrollment = Enrollment.query.filter_by(student_id=current_user["id"]).first()
        if not enrollment:
            return jsonify({"message": "No institution found for user"}), 400
        course = Course.query.get(enrollment.course_id)
        if not course:
            return jsonify({"message": "No course found for enrollment"}), 400
        institution_id = course.institution_id
    courses = Course.query.filter_by(institution_id=institution_id).all()
    return jsonify([{
        "id": c.id,
        "title": c.title,
        "code": c.code,
        "institution_id": c.institution_id,
        "instructor_id": c.instructor_id,
        "periods": c.periods if hasattr(c, "periods") and c.periods else ["Χειμερινό", "Εαρινό"]
    } for c in courses]), 200

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8002))
    app.run(host="0.0.0.0", port=port)


