import pexpect
import sys

print("Transferring database to VPS...")
child_scp1 = pexpect.spawn('scp -o StrictHostKeyChecking=no "backend/education.db" root@212.19.134.72:/root/education.db')
child_scp1.expect('assword:')
child_scp1.sendline('nurnur123')
child_scp1.expect(pexpect.EOF)
print("Database transfer complete.")

print("Transferring deploy script to VPS...")
child_scp2 = pexpect.spawn('scp -o StrictHostKeyChecking=no "auto_deploy_vps.sh" root@212.19.134.72:/root/auto_deploy_vps.sh')
child_scp2.expect('assword:')
child_scp2.sendline('nurnur123')
child_scp2.expect(pexpect.EOF)
print("Deploy script transfer complete.")

print("Executing deploy script on VPS...")
child_ssh = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72 "bash /root/auto_deploy_vps.sh"', timeout=600)
child_ssh.expect('assword:')
child_ssh.sendline('nurnur123')

# Read output continuously
for line in child_ssh:
    sys.stdout.write(line.decode('utf-8'))

child_ssh.expect(pexpect.EOF)
print("Deployment process finished.")
