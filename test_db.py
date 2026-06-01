import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('docker compose --env-file ~/projects/lms-qit/.env.deploy -f ~/projects/lms-qit/docker-compose.vps.yml exec -T db psql -U lms education_platform -c "\\dt"')
child.expect('# ')
print("DB TABLES:")
print(child.before.decode('utf-8'))

