import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=120)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

print("Restoring Nginx config with domain names...")
child.sendline('cp ~/projects/lms-qit/deploy/nginx-qazaqitacademy.example.conf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua')
child.expect('# ')

child.sendline('ln -sf /etc/nginx/sites-available/qazaqitacademy-edu.pp.ua /etc/nginx/sites-enabled/')
child.expect('# ')

child.sendline('rm -f /etc/nginx/sites-enabled/qazaqitacademy')
child.expect('# ')

child.sendline('nginx -t && systemctl reload nginx')
child.expect('# ')
print("Nginx reloaded.")

print("Running Certbot for HTTPS...")
child.sendline('certbot --nginx -d qazaqitacademy-edu.pp.ua -d www.qazaqitacademy-edu.pp.ua --non-interactive --agree-tos -m wennyqwerty4@gmail.com --redirect')
child.expect('# ')
print(child.before.decode('utf-8'))

