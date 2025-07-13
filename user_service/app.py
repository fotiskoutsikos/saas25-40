from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps
from dotenv import load_dotenv
import os
import requests

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    student_code = db.Column(db.String(20), unique=True)
    role = db.Column(db.String(30), nullable=False, default='STUDENT')
    institution_id = db.Column(db.String(36), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "student_code": self.student_code,
            "role": self.role,
            "institution_id": self.institution_id  # <-- Προσθήκη
        }

class Representative(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    institution_id = db.Column(db.String(36), nullable=True)

# Load environment variables from .env
load_dotenv()

# Initialize Flask app and SQLAlchemy
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///data.db')
    app.config['SECRET_KEY'] = os.getenv('JWT_SECRET', 'your_secret_key')
    db.init_app(app)

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
                current_user = User.query.filter_by(id=data['id']).first()
                if not current_user:
                    return jsonify({"message": "User not found!"}), 404
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
                if current_user.role not in roles:
                    return jsonify({"message": "You do not have permission to access this resource!"}), 403
                return f(current_user, *args, **kwargs)
            return decorated
        return decorator

    # Auth endpoints
    @app.route('/register', methods=['POST'])
    def register():
        data = request.get_json()

        # Check for duplicate username or email
        if User.query.filter_by(username=data['username']).first():
            return jsonify({"message": "Username already exists"}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"message": "Email already exists"}), 400

        # Validation for institution_id
        role = data.get('role', 'STUDENT')
        institution_id = data.get('institution_id')
        if role != 'INSTITUTION_REP' and not institution_id:
            return jsonify({"message": "Institution is required for this role"}), 400

        # Create new user
        hashed_password = generate_password_hash(data['password'], method='sha256')
        new_user = User(
            username=data['username'],
            email=data['email'],
            password=hashed_password,
            student_code=data.get('student_code'),
            role=role,
            institution_id=institution_id
        )
        db.session.add(new_user)
        db.session.commit()

        # Generate JWT token
        token = jwt.encode(
            {'id': new_user.id, 'role': new_user.role, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2),
             "institution_id": new_user.institution_id},
            app.config['SECRET_KEY'],
            algorithm="HS256"
        )
        return jsonify({"token": token, "id": new_user.id}), 201

    @app.route('/login', methods=['POST'])
    def login():
        data = request.get_json()
        user = User.query.filter_by(username=data['username']).first()
        if not user or not check_password_hash(user.password, data['password']):
            return jsonify({"message": "Invalid username or password"}), 401
        token_payload = {
            'id': user.id,
            'role': user.role,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2),
            "institution_id": user.institution_id
        }
        # if user.institution_id:
        #     token_payload['institution_id'] = user.institution_id
        token = jwt.encode(
            token_payload,
            app.config['SECRET_KEY'],
            algorithm="HS256"
        )
        print("DEBUG: institution_id in token =", user.institution_id)

        return jsonify({"token": token}), 200

    # User endpoints
    @app.route('/users/me', methods=['GET'])
    @token_required
    @roles_required("STUDENT", "INSTRUCTOR", "INSTITUTION_REP")
    def get_me(current_user):
        return jsonify(current_user.to_dict()), 200

    @app.route('/users/<id>', methods=['GET'])
    @token_required
    @roles_required("STUDENT", "INSTRUCTOR", "INSTITUTION_REP")
    def get_user(current_user, id):
        user = User.query.get(id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        return jsonify(user.to_dict()), 200

    @app.route('/users/<id>', methods=['PUT'])
    @token_required
    def update_user(current_user, id):
        # Επιτρέπει στον rep να αλλάζει οποιονδήποτε, αλλιώς μόνο τον εαυτό του
        if current_user.role != "INSTITUTION_REP" and str(current_user.id) != str(id):
            return jsonify({"message": "You can only update your own account"}), 403
        user = User.query.get(id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        data = request.get_json()
        if 'email' in data:
            user.email = data['email']
        if 'password' in data:
            user.password = generate_password_hash(data['password'], method='sha256')
        if 'institution_id' in data:
            user.institution_id = data['institution_id']
        db.session.commit()
        return jsonify(user.to_dict()), 200

    @app.route('/users/<id>', methods=['DELETE'])
    @token_required
    def delete_user(current_user, id):
        if current_user.id != int(id):
            return jsonify({"message": "You can only delete your own account"}), 403
        user = User.query.get(id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted"}), 200

    @app.route('/users', methods=['GET'])
    @token_required
    @roles_required("INSTITUTION_REP")
    def get_user_by_username(current_user):
        username = request.args.get('username')
        if not username:
            return jsonify({"message": "Username required"}), 400
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({"message": "User not found"}), 404
        return jsonify(user.to_dict()), 200

    # Students and Instructors endpoints
    @app.route('/students', methods=['GET'])
    @token_required
    @roles_required("INSTITUTION_REP", "INSTRUCTOR")
    def get_students(current_user):
        students = User.query.filter_by(role="STUDENT").all()
        return jsonify([u.to_dict() for u in students]), 200

    @app.route('/instructors', methods=['GET'])
    @token_required
    @roles_required("INSTITUTION_REP")
    def get_instructors(current_user):
        instructors = User.query.filter_by(role="INSTRUCTOR").all()
        return jsonify([u.to_dict() for u in instructors]), 200

    @app.route('/reps', methods=['GET'])
    @token_required
    @roles_required("INSTITUTION_REP")
    def get_reps(current_user):
        reps = User.query.filter_by(role="INSTITUTION_REP").all()
        return jsonify([u.to_dict() for u in reps]), 200

    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "healthy"}), 200

    return app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    create_app().run(host="0.0.0.0", port=port)
