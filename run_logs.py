import pexpect
import sys

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('cd ~/projects/lms-qit && docker compose --env-file .env.deploy -f docker-compose.vps.yml ps')
child.expect('# ')
print("DOCKER PS:")
print(child.before.decode('utf-8'))

child.sendline('cd ~/projects/lms-qit && docker compose --env-file .env.deploy -f docker-compose.vps.yml logs backend --tail=10')
child.expect('# ')
print("BACKEND LOGS:")
print(child.before.decode('utf-8'))

child.sendline('cd ~/projects/lms-qit && docker compose --env-file .env.deploy -f docker-compose.vps.yml logs frontend --tail=10')
child.expect('# ')
print("FRONTEND LOGS:")
print(child.before.decode('utf-8'))

