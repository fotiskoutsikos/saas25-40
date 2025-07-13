FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY . .

# Expose the port the app runs on
EXPOSE 8005

CMD ["python", "app.py"]