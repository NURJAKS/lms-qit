import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('ufw allow 80/tcp && ufw allow 443/tcp && ufw reload')
child.expect('# ')
print("UFW STATUS:")
print(child.before.decode('utf-8'))

