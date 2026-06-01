import urllib.request
try:
    resp = urllib.request.urlopen("https://qazaqitacademy-edu.pp.ua")
    print(f"Status Code: {resp.status}")
except Exception as e:
    print(f"Error: {e}")
