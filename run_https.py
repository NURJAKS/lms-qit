import urllib.request
import ssl

try:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    resp = urllib.request.urlopen("https://212.19.134.72", context=ctx)
    print(f"Status Code HTTPS: {resp.status}")
except Exception as e:
    print(f"Error HTTPS: {e}")
