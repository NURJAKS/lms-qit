import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=120)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('certbot --nginx -d qazaqitacademy-edu.pp.ua -d www.qazaqitacademy-edu.pp.ua --non-interactive --agree-tos -m wennyqwerty4@gmail.com --redirect')
child.expect('# ')
print("CERTBOT OUTPUT:")
print(child.before.decode('utf-8'))

