import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('rm /etc/nginx/sites-enabled/default')
child.expect('# ')

child.sendline('nginx -t && systemctl reload nginx')
child.expect('# ')

print("NGINX RELOADED")
