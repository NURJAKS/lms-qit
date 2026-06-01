import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

# Add the IP address to the server_name directive in the HTTP and HTTPS blocks
child.sendline('sed -i "s/server_name qazaqitacademy-edu.pp.ua www.qazaqitacademy-edu.pp.ua;/server_name qazaqitacademy-edu.pp.ua www.qazaqitacademy-edu.pp.ua 212.19.134.72;/g" /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua')
child.expect('# ')

child.sendline('nginx -t && systemctl reload nginx')
child.expect('# ')
print("NGINX RELOADED WITH IP SUPPORT")

