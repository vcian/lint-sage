import { confirm } from '@inquirer/prompts';
import type { EnvironmentState, ActionPlan } from './types.js';

export function displayReport(
  env: EnvironmentState,
  plan: ActionPlan,
): void {
  console.log('\n📋 Environment Report');
  console.log('─'.repeat(40));

  console.log(`  Node:            v${env.node.major}.${env.node.minor}.${env.node.patch}`);
  console.log(`  Package Manager: ${env.packageManager.name} v${env.packageManager.version}`);
  console.log(`  Framework:       ${env.framework ?? 'not detected'}`);
  console.log(`  Git:             ${env.git ? 'yes' : 'no'}`);

  console.log('\n🔧 Tools');
  console.log('─'.repeat(40));

  for (const [toolName, toolInfo] of env.tools) {
    if (toolInfo.installed) {
      console.log(`  ${toolName}: installed (v${toolInfo.version}) — will configure`);
    } else {
      console.log(`  ${toolName}: not installed — will install + configure`);
    }
  }

  if (plan.depsToInstall.length > 0) {
    console.log('\n📦 Dependencies to Install');
    console.log('─'.repeat(40));
    for (const dep of plan.depsToInstall) {
      console.log(`  ${dep.name}@${dep.version}`);
    }
  }

  if (Object.keys(plan.scriptsToAdd).length > 0) {
    console.log('\n📝 Scripts to Add');
    console.log('─'.repeat(40));
    for (const [name, cmd] of Object.entries(plan.scriptsToAdd)) {
      console.log(`  "${name}": "${cmd}"`);
    }
  }

  if (plan.configsToWrite.length > 0) {
    console.log('\n📄 Config Files to Write');
    console.log('─'.repeat(40));
    for (const config of plan.configsToWrite) {
      const overwrite = plan.existingFileOverwrites.includes(config.targetPath);
      console.log(`  ${config.targetPath}${overwrite ? ' (exists — will prompt)' : ''}`);
    }
  }

  console.log('');
}

export async function confirmProceed(): Promise<boolean> {
  return confirm({
    message: 'Proceed with setup?',
    default: true,
  });
}
