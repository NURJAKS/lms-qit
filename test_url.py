import urllib.request
import ssl

try:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    resp = urllib.request.urlopen("https://qazaqitacademy-edu.pp.ua", context=ctx)
    print(f"Status Code: {resp.status}")
except Exception as e:
    print(f"Error: {e}")
