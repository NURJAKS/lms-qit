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

child.sendline('nginx -t')
child.expect('# ')
print("NGINX TEST:")
print(child.before.decode('utf-8'))

child.sendline('certbot certificates')
child.expect('# ')
print("CERTBOT:")
print(child.before.decode('utf-8'))

