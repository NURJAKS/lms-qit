import pexpect
import sys

print("Fixing PYTHONPATH for migration on VPS...")
child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=600)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

# Change path to pythonpath inside bash
child.sendline('cd ~/projects/lms-qit && sed -i \'s/--entrypoint python \\\\/--entrypoint sh \\\\/g\' deploy/migrate-sqlite-to-pg.sh')
child.expect('# ')

child.sendline('cd ~/projects/lms-qit && sed -i \'s/backend scripts\\/migrate_sqlite_to_pg.py \\\\/backend -c "PYTHONPATH=\\/app python \\/app\\/scripts\\/migrate_sqlite_to_pg.py \\/tmp\\/migrate_source.db --force" \\\\/g\' deploy/migrate-sqlite-to-pg.sh')
child.expect('# ')

child.sendline('cd ~/projects/lms-qit && sed -i \'/--sqlite-url sqlite/d\' deploy/migrate-sqlite-to-pg.sh')
child.expect('# ')

child.sendline('cd ~/projects/lms-qit && sed -i \'/--force/d\' deploy/migrate-sqlite-to-pg.sh')
child.expect('# ')

# Now run it again
child.sendline('cd ~/projects/lms-qit && ./deploy/migrate-sqlite-to-pg.sh /root/education.db')

for line in child:
    sys.stdout.write(line.decode('utf-8'))
    if "Запуск полного стека" in line.decode('utf-8'):
        break

child.sendline('cd ~/projects/lms-qit && docker compose --env-file .env.deploy -f docker-compose.vps.yml up -d --build')

for line in child:
    sys.stdout.write(line.decode('utf-8'))
    if "Started" in line.decode('utf-8') or "Running" in line.decode('utf-8') or "Healthy" in line.decode('utf-8'):
        pass
