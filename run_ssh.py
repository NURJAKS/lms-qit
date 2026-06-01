import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72 "uptime"')
child.expect('assword:')
child.sendline('nurnur123')
print(child.read().decode('utf-8'))
