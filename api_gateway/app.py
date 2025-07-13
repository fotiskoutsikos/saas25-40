from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
import os
import jwt
import requests
from urllib.parse import urljoin
from functools import wraps

# Load environment variables from .env
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your_secret_key')
SERVICE_URLS = {
    service.split('=')[0]: service.split('=')[1]
    for service in os.getenv('SERVICE_URLS', '').split(',')
    if '=' in service
}
PORT = int(os.getenv('PORT', 8080))

# Middleware: Verify JWT for /api/ routes
@app.before_request
def verify_jwt():
    if request.method == 'OPTIONS':
        return
    # Εξαίρεση για login/register και institutions/public
    if request.path in [
        '/api/user_service/login',
        '/api/user_service/register',
        '/api/institution_service/institutions/public'
    ]:
        return
    if request.path.startswith('/api/'):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"message": "Missing or invalid token"}), 401
        token = auth_header.split(' ')[1]
        try:
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return '', 200
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"message": "Missing or invalid token"}), 401
        token = auth_header.split(' ')[1]
        try:
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

# Dynamic proxy route
@app.route('/api/<service>/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy(service, path):
    if service not in SERVICE_URLS:
        return jsonify({"message": f"Service '{service}' not found"}), 404

    target = SERVICE_URLS[service]
    url = urljoin(target, path)

    try:
        headers = {}
        if request.headers.get("Authorization"):
            headers["Authorization"] = request.headers.get("Authorization")

        # Αν είναι multipart/form-data, στείλε data και files
        if request.method in ['POST', 'PUT', 'DELETE']:
            if request.content_type and request.content_type.startswith('multipart/form-data'):
                resp = requests.request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    params=request.args,
                    data=request.form,
                    files=request.files
                )
            else:
                resp = requests.request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    params=request.args,
                    json=request.get_json(silent=True),
                )
        else:
            resp = requests.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.args,
            )

        return Response(
            resp.content,
            status=resp.status_code,
            headers=dict(resp.headers),
        )
    except Exception as e:
        return jsonify({"message": "Internal server error", "error": str(e)}), 500

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
