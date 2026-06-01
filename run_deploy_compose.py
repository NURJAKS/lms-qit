import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=600)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('cd ~/projects/lms-qit && docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build')

for line in child:
    sys.stdout.write(line.decode('utf-8'))
    if "Started" in line.decode('utf-8') or "Running" in line.decode('utf-8') or "Healthy" in line.decode('utf-8'):
        pass
