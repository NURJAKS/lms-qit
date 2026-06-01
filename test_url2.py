import urllib.request

try:
    resp = urllib.request.urlopen("http://qazaqitacademy-edu.pp.ua")
    print(f"Status Code HTTP: {resp.status}")
except Exception as e:
    print(f"Error HTTP: {e}")
