from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
from dotenv import load_dotenv
import jwt
import datetime
import os
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
class PaymentStatus:
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"

class CreditPurchase(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    institution_id = db.Column(db.String(36), nullable=False)
    credits_bought = db.Column(db.Integer, nullable=False)
    amount_paid = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), nullable=False, default=PaymentStatus.PENDING)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

class PaymentDetail(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_id = db.Column(db.String(36), db.ForeignKey('credit_purchase.id'), nullable=False)
    method = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=PaymentStatus.PENDING)

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

# Endpoints
@app.route('/purchases', methods=['POST'])
@token_required
@roles_required("INSTITUTION_REP")
def create_purchase(current_user):
    data = request.get_json()
    new_purchase = CreditPurchase(
        institution_id=data['institution_id'],
        credits_bought=data['credits_bought'],
        amount_paid=data['amount_paid']
    )
    db.session.add(new_purchase)
    db.session.commit()

    new_payment = PaymentDetail(
        purchase_id=new_purchase.id,
        method=data['method']
    )
    db.session.add(new_payment)
    db.session.commit()

    return jsonify({
        "id": new_purchase.id,
        "institution_id": new_purchase.institution_id,
        "credits_bought": new_purchase.credits_bought,
        "amount_paid": new_purchase.amount_paid,
        "status": new_purchase.status,
        "payment_details": {
            "id": new_payment.id,
            "method": new_payment.method,
            "status": new_payment.status
        }
    }), 201

@app.route('/purchases', methods=['GET'])
@token_required
@roles_required("INSTITUTION_REP")
def get_purchases(current_user):
    institution_id = request.args.get('institution_id')
    if institution_id:
        purchases = CreditPurchase.query.filter_by(institution_id=institution_id).all()
    else:
        purchases = CreditPurchase.query.all()

    return jsonify([{
        "id": purchase.id,
        "institution_id": purchase.institution_id,
        "credits_bought": purchase.credits_bought,
        "amount_paid": purchase.amount_paid,
        "status": purchase.status,
        "created_at": purchase.created_at,
        "completed_at": purchase.completed_at
    } for purchase in purchases]), 200

@app.route('/purchases/<purchase_id>', methods=['GET'])
@token_required
@roles_required("INSTITUTION_REP")
def get_purchase(current_user, purchase_id):
    purchase = CreditPurchase.query.get(purchase_id)
    if not purchase:
        return jsonify({"message": "Purchase not found"}), 404

    payment_detail = PaymentDetail.query.filter_by(purchase_id=purchase_id).first()
    return jsonify({
        "id": purchase.id,
        "institution_id": purchase.institution_id,
        "credits_bought": purchase.credits_bought,
        "amount_paid": purchase.amount_paid,
        "status": purchase.status,
        "created_at": purchase.created_at,
        "completed_at": purchase.completed_at,
        "payment_details": {
            "id": payment_detail.id,
            "method": payment_detail.method,
            "status": payment_detail.status
        }
    }), 200

@app.route('/purchases/<purchase_id>/complete', methods=['PUT'])
@token_required
@roles_required("INSTITUTION_REP")
def complete_purchase(current_user, purchase_id):
    purchase = CreditPurchase.query.get(purchase_id)
    if not purchase:
        return jsonify({"message": "Purchase not found"}), 404

    payment_detail = PaymentDetail.query.filter_by(purchase_id=purchase_id).first()
    if not payment_detail:
        return jsonify({"message": "Payment details not found"}), 404

    # Simulate payment processing
    payment_detail.status = PaymentStatus.COMPLETED
    purchase.status = PaymentStatus.COMPLETED
    purchase.completed_at = datetime.datetime.utcnow()
    db.session.commit()

    # Call institution_service to add credits
    institution_service_url = f"http://institution_service:8002/institutions/{str(purchase.institution_id)}/balance/add"
    headers = {}
    if "Authorization" in request.headers:
        headers["Authorization"] = request.headers["Authorization"]
    response = requests.post(institution_service_url, json={"amount": purchase.credits_bought}, headers=headers)
    print("DEBUG:", response.status_code, response.text)
    if response.status_code != 200:
        return jsonify({"message": "Failed to update institution credits"}), 400

    return jsonify({
        "id": purchase.id,
        "institution_id": purchase.institution_id,
        "credits_bought": purchase.credits_bought,
        "amount_paid": purchase.amount_paid,
        "status": purchase.status,
        "created_at": purchase.created_at,
        "completed_at": purchase.completed_at,
        "payment_details": {
            "id": payment_detail.id,
            "method": payment_detail.method,
            "status": payment_detail.status
        }
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8003))
    app.run(host="0.0.0.0", port=port)
