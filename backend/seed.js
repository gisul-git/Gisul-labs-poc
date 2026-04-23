require('dotenv').config();
const connectDB = require('./db');
const Lab = require('./models/Lab');

const TEMPLATE_ID = parseInt(process.env.SEED_TEMPLATE_ID || '100');

const lab = {
  title: 'MongoDB Installation Lab',
  description: 'In this lab you will explore your Windows VM and install MongoDB. Follow each step — some require you to act inside the VM, others run automatically.',
  templateId: TEMPLATE_ID,
  steps: [
    {
      stepId: 'open_control_panel',
      title: 'Open Control Panel',
      type: 'manual',
      scriptType: null,
      command: '',
      instructions: `Let's start by opening the Control Panel on your Windows VM.\n\nSteps:\n1. Click the Start menu (Windows icon) in the bottom-left corner\n2. Type "Control Panel" in the search bar\n3. Click on "Control Panel" when it appears\n\nYou should see the Control Panel window open with categories like System and Security, Network and Internet, etc.\n\nOnce you've opened it, tick the checkbox to continue.`,
    },
    {
      stepId: 'open_notepad',
      title: 'Open Notepad and Type Something',
      type: 'manual',
      scriptType: null,
      command: '',
      instructions: `Now let's open Notepad and type a message.\n\nSteps:\n1. Press Win + R to open the Run dialog\n2. Type "notepad" and press Enter\n3. In Notepad, type: Hello from my lab VM!\n4. You can save it with Ctrl+S if you like\n\nNotepad is a simple text editor built into Windows. It's useful for quick notes and editing config files.\n\nOnce done, tick the checkbox to continue.`,
    },
    {
      stepId: 'create_folder',
      title: 'Create a Folder on Desktop',
      type: 'action',
      scriptType: 'powershell',
      command: `New-Item -ItemType Directory -Path "$env:USERPROFILE\\Desktop\\MyLabFolder" -Force | Out-Null; Write-Output "Folder created at $env:USERPROFILE\\Desktop\\MyLabFolder"`,
      instructions: `This step will automatically create a folder called "MyLabFolder" on the Desktop of your Windows VM.\n\nWhat happens when you click Execute:\n- A PowerShell command runs on your VM\n- It creates a new folder at: Desktop\\MyLabFolder\n- You should see it appear on the Desktop\n\nAfter execution, switch to your VM console and check the Desktop — the folder should be there.\n\nClick "Execute Step" to create the folder automatically.`,
    },
    {
      stepId: 'open_task_manager',
      title: 'Open Task Manager',
      type: 'manual',
      scriptType: null,
      command: '',
      instructions: `Task Manager lets you see what's running on your VM.\n\nSteps:\n1. Press Ctrl + Shift + Esc to open Task Manager directly\n   OR right-click the taskbar and select "Task Manager"\n2. Click "More details" if it opens in compact mode\n3. Explore the Processes tab — you'll see running apps and background processes\n4. Check the Performance tab to see CPU and Memory usage\n\nOnce you've explored Task Manager, tick the checkbox to continue.`,
    },
    {
      stepId: 'check_system_info',
      title: 'Check System Information',
      type: 'action',
      scriptType: 'powershell',
      command: `$info = Get-ComputerInfo | Select-Object CsName, OsName, OsVersion, CsProcessors, CsTotalPhysicalMemory; Write-Output "Hostname: $($info.CsName)"; Write-Output "OS: $($info.OsName)"; Write-Output "Version: $($info.OsVersion)"; Write-Output "RAM: $([math]::Round($info.CsTotalPhysicalMemory / 1GB, 2)) GB"`,
      instructions: `This step runs a PowerShell command to fetch your VM's system information.\n\nWhat you'll see:\n- Hostname (computer name)\n- Windows OS version\n- Number of processors\n- Total RAM\n\nThis is useful for verifying your VM specs before installing software.\n\nClick "Execute Step" to fetch the system info automatically.`,
    },
    {
      stepId: 'install_mongodb',
      title: 'Install MongoDB',
      type: 'action',
      scriptType: 'powershell',
      command: `Invoke-WebRequest -Uri "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.6-signed.msi" -OutFile "C:\\mongo.msi"; Start-Process "msiexec.exe" -ArgumentList "/i C:\\mongo.msi /quiet ADDLOCAL=ServerService,Client,Router,MiscellaneousFiles,Server SHOULD_INSTALL_COMPASS=0" -Wait; Start-Sleep -Seconds 5; Start-Service -Name MongoDB -ErrorAction SilentlyContinue;`,
      instructions: `This is the main step — it downloads and installs MongoDB 6.0 on your Windows VM.\n\nWhat happens:\n- Downloads the MongoDB MSI installer (~500MB) to C:\\mongo.msi\n- Installs MongoDB silently including the Windows Service\n- Starts the MongoDB service automatically\n\nThis will take 3-5 minutes depending on your internet speed.\n\nAfter completion you can verify inside the VM:\n- Open Services (services.msc) → look for "MongoDB"\n- Open PowerShell and run: Get-Service MongoDB\n- Data directory: C:\\Program Files\\MongoDB\\Server\\6.0\\data\n\nClick "Execute Step" to start the installation.`,
    },
    {
      stepId: 'verify_mongodb',
      title: 'Verify MongoDB Service',
      type: 'action',
      scriptType: 'powershell',
      command: `Get-Service | Where-Object {$_.Name -like "Mongo*"} | Select-Object Name, Status | ConvertTo-Json`,
      instructions: `This step verifies that the MongoDB Windows service is running correctly.\n\nWhat to expect:\n- You should see the MongoDB service listed with Status "Running"\n- If it shows "Stopped", the install may have completed but the service needs to be started\n\nManual check inside the VM (open PowerShell):\n  Get-Service MongoDB\n\nYou can also navigate to:\n  C:\\Program Files\\MongoDB\\Server\\6.0\\bin\nand run mongod.exe directly to test.`,
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
