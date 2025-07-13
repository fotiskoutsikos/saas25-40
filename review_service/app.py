from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
from dotenv import load_dotenv
import jwt
import os
import datetime
import uuid
import requests

# Load environment variables from .env
load_dotenv()

# Initialize Flask app and SQLAlchemy
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///data.db')
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET', 'your_secret_key')
db = SQLAlchemy(app)

# Models
class ReviewStatus:
    PENDING = "PENDING"
    ADDRESSED = "ADDRESSED"

class ReviewRequest(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    entry_id = db.Column(db.String(36), nullable=False)
    student_code = db.Column(db.String(20), nullable=False)
    course_code = db.Column(db.String(20), nullable=False)  # <-- πρόσθεσε αυτό!
    reason = db.Column(db.String(500), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=ReviewStatus.PENDING)
    requested_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class ReviewResponse(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = db.Column(db.String(36), db.ForeignKey('review_request.id'), nullable=False)
    instructor_id = db.Column(db.String(36), nullable=False)
    new_grade_value = db.Column(db.Float, nullable=True)
    comments = db.Column(db.String(500), nullable=False)
    responded_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# Create all tables on first request
with app.app_context():
    db.create_all()

# JWT token decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"message": "Token is missing!"}), 401
        # Διόρθωση: αφαίρεσε το "Bearer " αν υπάρχει
        if token.startswith("Bearer "):
            token = token.split(" ", 1)[1]
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired!"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Token is invalid!"}), 401
        return f(data, *args, **kwargs)
    return decorated

# Endpoints
@app.route('/reviews', methods=['POST'])
@token_required
def create_review_request(user_data):
    if user_data.get('role') != 'STUDENT':
        return jsonify({"message": "Unauthorized"}), 403

    data = request.get_json()
    if not data.get('entry_id') or not data.get('student_code') or not data.get('reason'):
        return jsonify({"message": "Missing required fields"}), 400

    new_request = ReviewRequest(
        entry_id=data['entry_id'],
        student_code=data['student_code'],
        course_code=data.get('course_code', ''),  # <-- πρόσθεσε αυτό!
        reason=data['reason']
    )
    db.session.add(new_request)
    db.session.commit()

    return jsonify({
        "id": new_request.id,
        "entry_id": new_request.entry_id,
        "student_code": new_request.student_code,
        "reason": new_request.reason,
        "status": new_request.status,
        "requested_at": new_request.requested_at
    }), 201

@app.route('/reviews', methods=['GET'])
@token_required
def get_review_requests(user_data):
    status = request.args.get('status')
    if user_data.get('role') == 'INSTRUCTOR':
        try:
            inst_url = os.getenv("INSTITUTION_SERVICE_URL", "http://institution_service:8002")
            # Πάρε το Authorization header από το αρχικό request
            auth_header = request.headers.get("Authorization")
            print("Authorization header sent to institution_service:", auth_header)
            resp = requests.get(
                f"{inst_url}/instructor/courses",
                headers={"Authorization": auth_header},
                timeout=5
            )
            print("institution_service status:", resp.status_code)
            print("institution_service body:", resp.text)
            if resp.status_code == 200:
                courses = resp.json()
                course_codes = [c["code"] for c in courses if "code" in c]
            else:
                return jsonify({"message": "Could not fetch instructor courses", "status": resp.status_code, "body": resp.text}), 502
        except Exception as e:
            return jsonify({"message": "Error contacting institution_service", "error": str(e)}), 502

        query = ReviewRequest.query.filter(ReviewRequest.course_code.in_(course_codes))
        if status:
            query = query.filter_by(status=status)
        requests_list = query.all()
    elif user_data.get('role') == 'STUDENT':
        student_code = request.args.get('student_code')
        if not student_code:
            return jsonify({"message": "Missing student_code"}), 400
        requests_list = ReviewRequest.query.filter_by(student_code=student_code).all()
    else:
        requests_list = []

    try:
        result = []
        for req in requests_list:
            result.append({
                "id": req.id,
                "entry_id": req.entry_id,
                "student_code": req.student_code,
                "course_code": req.course_code,
                "period": getattr(req, "period", ""),
                "reason": req.reason,
                "status": req.status,
                "requested_at": str(req.requested_at) if req.requested_at else ""
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"message": "Mapping error", "error": str(e)}), 500

@app.route('/reviews/<request_id>', methods=['GET'])
@token_required
def get_review_request(user_data, request_id):
    review_request = ReviewRequest.query.get(request_id)
    if not review_request:
        return jsonify({"message": "Review request not found"}), 404

    if user_data.get('role') == 'STUDENT' and review_request.student_code != user_data['student_code']:
        return jsonify({"message": "Unauthorized"}), 403

    return jsonify({
        "id": review_request.id,
        "entry_id": review_request.entry_id,
        "student_code": review_request.student_code,
        "reason": review_request.reason,
        "status": review_request.status,
        "requested_at": review_request.requested_at
    }), 200

@app.route('/reviews/<request_id>/reply', methods=['POST'])
@token_required
def reply_review_request(user_data, request_id):
    if user_data.get('role', '').upper() != 'INSTRUCTOR':
        return jsonify({"message": "Unauthorized"}), 403

    review_request = ReviewRequest.query.get(request_id)
    if not review_request or review_request.status != ReviewStatus.PENDING:
        return jsonify({"message": "Review request not found or already addressed"}), 404

    # Ανέβασε attachment αν υπάρχει
    comments = request.form.get('message', '')
    action = request.form.get('action', '')
    attachment = request.files.get('attachment')
    new_grade_value = request.form.get('new_grade')
    instructor_id = user_data.get('id')

    # Αποθήκευσε το attachment αν υπάρχει (προαιρετικά)
    attachment_path = None
    if attachment:
        upload_folder = os.getenv('UPLOAD_FOLDER', '/tmp')
        os.makedirs(upload_folder, exist_ok=True)
        filename = f"{uuid.uuid4()}_{attachment.filename}"
        filepath = os.path.join(upload_folder, filename)
        attachment.save(filepath)
        attachment_path = filepath

    # Δημιούργησε ReviewResponse
    new_response = ReviewResponse(
        request_id=review_request.id,
        instructor_id=instructor_id,
        new_grade_value=float(new_grade_value) if new_grade_value else None,
        comments=comments
        # Μπορείς να προσθέσεις attachment_path αν το βάλεις στο μοντέλο
    )
    db.session.add(new_response)

    # Ενημέρωσε το status του ReviewRequest
    review_request.status = ReviewStatus.ADDRESSED
    db.session.commit()

    # Αν υπάρχει new_grade_value, ενημέρωσε το grading_service
    if new_grade_value:
        grading_service_url = f"http://grading_service:8004/grades/entry/{review_request.entry_id}"
        response = requests.post(grading_service_url, json={"grade_value": float(new_grade_value)})
        if response.status_code != 200:
            return jsonify({"message": "Failed to update grade in grading_service"}), 400

    return jsonify({
        "id": new_response.id,
        "request_id": new_response.request_id,
        "instructor_id": new_response.instructor_id,
        "new_grade_value": new_response.new_grade_value,
        "comments": new_response.comments,
        "responded_at": new_response.responded_at
    }), 200

@app.route('/reviews/<request_id>', methods=['DELETE'])
@token_required
def delete_review_request(user_data, request_id):
    review_request = ReviewRequest.query.get(request_id)
    if not review_request:
        return jsonify({"message": "Review request not found"}), 404

    # Allow only the student who created the request or an instructor to delete it
    if user_data.get('role') == 'STUDENT' and review_request.status != ReviewStatus.PENDING:
        return jsonify({"message": "Unauthorized"}), 403
    if user_data.get('role') == 'INSTRUCTOR' and review_request.status != ReviewStatus.PENDING:
        return jsonify({"message": "Only pending requests can be deleted by instructors"}), 403

    db.session.delete(review_request)
    db.session.commit()
    return '', 204

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200



#get the result for a specific request
@app.route('/reviews/<request_id>/result', methods=['GET'])
@token_required
def get_review_result(user_data, request_id):
    review_request = ReviewRequest.query.get(request_id)
    if not review_request:
        return jsonify({"message": "Review request not found"}), 404

    if user_data.get('role') != 'STUDENT' :
        return jsonify({"message": "Unauthorized"}), 403
    #if user_data.get('role') != 'STUDENT' or review_request.student_code != user_data['student_code']:
      

    review_response = ReviewResponse.query.filter_by(request_id=review_request.id).first()

    if not review_response:
        return jsonify({
            "request_id": review_request.id,
            "entry_id": review_request.entry_id,
            "course_code": review_request.course_code,
            "reason": review_request.reason,
            "status": review_request.status,
            "requested_at": str(review_request.requested_at),
            "message": "Your review is still pending."
        }), 200

    return jsonify({
        "request_id": review_request.id,
        "entry_id": review_request.entry_id,
        "course_code": review_request.course_code,
        "reason": review_request.reason,
        "status": review_request.status,
        "requested_at": str(review_request.requested_at),
        "response": {
            "response_id": review_response.id,
            "instructor_id": review_response.instructor_id,
            "new_grade_value": review_response.new_grade_value,
            "comments": review_response.comments,
            "responded_at": str(review_response.responded_at)
        }
    }), 200


@app.route('/reviews/status/<entry_id>/<student_code>', methods=['GET'])
@token_required
def check_review_status(user_data, entry_id, student_code):
    """
    Checks if a review request already exists for a given entry_id and student_code.
    """
    if user_data.get('role') != 'STUDENT' and user_data.get('student_code') != student_code:
        return jsonify({"message": "Unauthorized"}), 403

    existing_review = ReviewRequest.query.filter_by(
        entry_id=entry_id,
        student_code=student_code
    ).first()

    if existing_review:
        return jsonify({
            "has_review_request": True,
            "status": existing_review.status,
            "request_id": existing_review.id
        }), 200
    else:
        return jsonify({"has_review_request": False}), 200
    

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8005))
    app.run(host="0.0.0.0", port=port)

