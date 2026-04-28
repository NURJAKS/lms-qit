
import sys
import os
from pathlib import Path

# Add backend to sys.path
backend_path = Path("/home/nurjaks/Dev/LMS platform - order/backend").resolve()
sys.path.append(str(backend_path))

from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token
from app.core.config import settings
import requests
import json

def test_reproduce_500():
    # 1. Get a token for teacher1@edu.kz (ID 4)
    token = create_access_token({"sub": "teacher1@edu.kz"})
    
    url = "http://localhost:8000/api/teacher/assignments"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Payload for a synopsis
    payload = {
        "group_id": 1,
        "course_id": 1,
        "topic_id": 40,
        "title": "A" * 251,  # This + "Тест: " should exceed 255
        "description": "Test description",
        "is_synopsis": True,
        "max_points": 100
    }
    
    # We can't hit the real server easily if it's not running,
    # but we can try to call the route function directly or use TestClient.
    from fastapi.testclient import TestClient
    from app.main import app
    
    client = TestClient(app)
    response = client.post("/api/teacher/assignments", json=payload, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")

if __name__ == "__main__":
    test_reproduce_500()
