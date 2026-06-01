import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('systemctl status nginx --no-pager')
child.expect('# ')
print("NGINX STATUS:")
print(child.before.decode('utf-8'))

