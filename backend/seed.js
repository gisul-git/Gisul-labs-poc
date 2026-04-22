require('dotenv').config();
const connectDB = require('./db');
const Lab = require('./models/Lab');

const TEMPLATE_ID = parseInt(process.env.SEED_TEMPLATE_ID || '100');

const lab = {
  title: 'MongoDB Installation Lab',
  description: 'In this lab you will install MongoDB on a Windows Server VM using PowerShell automation. Follow each step in the sidebar and click Execute to run the automation.',
  templateId: TEMPLATE_ID,
  steps: [
    {
      stepId: 'install_mongodb',
      title: 'Install MongoDB',
      type: 'action',
      scriptType: 'powershell',
      command: `Invoke-WebRequest -Uri "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.6-signed.msi" -OutFile "C:\\mongo.msi"; Start-Process "msiexec.exe" -ArgumentList "/i C:\\mongo.msi /quiet ADDLOCAL=ServerService,Client,Router,MiscellaneousFiles,Server SHOULD_INSTALL_COMPASS=0" -Wait; Start-Sleep -Seconds 5; Start-Service -Name MongoDB -ErrorAction SilentlyContinue;`,
      instructions: `This step downloads and silently installs MongoDB 6.0 on your Windows VM.\n\nWhat happens:\n- The MSI installer is downloaded to C:\\mongo.msi\n- It installs silently (no UI) via msiexec\n- The MongoDB service is registered automatically\n\nAfter completion, you can verify the install:\n- Open Services (services.msc) and look for "MongoDB"\n- Or open PowerShell and run: Get-Service MongoDB\n- Data directory will be at: C:\\Program Files\\MongoDB\\Server\\6.0\\data`,
    },
    {
      stepId: 'verify_mongodb',
      title: 'Verify MongoDB Service',
      type: 'action',
      scriptType: 'powershell',
      command: `Get-Service | Where-Object {$_.Name -like "Mongo*"} | Select-Object Name, Status | ConvertTo-Json`,
      instructions: `This step verifies that the MongoDB Windows service is running correctly.\n\nWhat to expect:\n- You should see the MongoDB service listed with Status "Running"\n- If it shows "Stopped", the install may have completed but the service needs to be started\n\nManual check (open PowerShell inside the VM):\n  Get-Service MongoDB\n  net start MongoDB\n\nYou can also navigate to:\n  C:\\Program Files\\MongoDB\\Server\\6.0\\bin\nand run mongod.exe directly to test.`,
    },
    {
      stepId: 'create_test_db',
      title: 'Create Test Database',
      type: 'action',
      scriptType: 'powershell',
      command: `$mongo = "C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongosh.exe"; & $mongo --eval "db.getSiblingDB('testlab').createCollection('hello'); print('DB created')" --quiet`,
      instructions: `This step uses mongosh (MongoDB Shell) to create a test database called "testlab".\n\nWhat happens:\n- Connects to the local MongoDB instance on port 27017\n- Creates a database named "testlab"\n- Creates a collection called "hello" inside it\n\nYou can explore further inside the VM:\n- Open PowerShell and run: mongosh\n- Then type: show dbs\n- You should see "testlab" listed\n- Navigate into it: use testlab\n- List collections: show collections`,
    },
  ],
};

async function seed() {
  await connectDB();
  await Lab.deleteMany({});
  const created = await Lab.create(lab);
  console.log(`[Seed] Created lab: "${created.title}" (${created._id})`);
  console.log(`[Seed] Steps: ${created.steps.map(s => s.stepId).join(', ')}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('[Seed] Error:', err.message);
  process.exit(1);
});
