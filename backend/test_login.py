import requests
try:
    resp = requests.post("http://localhost:8000/api/auth/login", json={"username": "admin", "password": "password"})
    print(resp.status_code)
    print(resp.json())
except Exception as e:
    print("Error:", e)
