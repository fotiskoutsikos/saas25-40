import uuid
from datetime import datetime
from decimal import Decimal
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID
from enum import Enum

db = SQLAlchemy()

class PaymentStatus(Enum):
    PENDING   = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED    = "FAILED"

class CreditPurchase(db.Model):
    __tablename__ = "credit_purchases"
    purchase_id    = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = db.Column(UUID(as_uuid=True), nullable=False)
    credits_bought = db.Column(db.Integer, nullable=False)
    purchase_date  = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    amount_paid    = db.Column(db.Numeric(10,2), nullable=False)

    def process_payment(self, details: "PaymentDetail") -> bool:
        # stub: ενημέρωση status και επιστροφή True/False
        return details.status == PaymentStatus.COMPLETED

class PaymentDetail(db.Model):
    __tablename__ = "payment_details"
    payment_id  = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_id = db.Column(UUID(as_uuid=True),
                             db.ForeignKey("credit_purchases.purchase_id"),
                             nullable=False)
    method      = db.Column(db.String(50), nullable=False)
    status      = db.Column(db.Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
