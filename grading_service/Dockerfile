FROM python:3.9-slim-bullseye

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      gfortran \
      libatlas-base-dev \
      libopenblas-dev \
      liblapack-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port the app runs on
EXPOSE 8004

CMD ["python", "app.py"]