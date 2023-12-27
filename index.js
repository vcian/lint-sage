#!/usr/bin/env node

const { copyFileSync, mkdir } = require("fs");
const { resolve } = require("path");
const { execSync } = require("child_process");
const select = require("@inquirer/select").default;
const { name: packageName } = require("./package.json");

function help(code) {
  console.log(`Usage:
  ${packageName} init
  ${packageName} init --force
  `);
  process.exit(code);
}

const reactPackagesInstallCmd = ({ install, devInstall, forceCMD }) => {
  execSync(
    `${install} @types/node @types/react @types/react-dom eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-next  eslint-config-prettier eslint-plugin-jsx-a11y eslint-plugin-prettier eslint-plugin-promise eslint-plugin-react eslint-plugin-react-hooks  husky lint-staged prettier ${devInstall} ${forceCMD}`,
    {
      stdio: "inherit",
    }
  );
};

const nestPackagesInstallCmd = ({ install, devInstall, forceCMD }) => {
  execSync(
    `${install} eslint-config-prettier eslint-plugin-prettier eslint-plugin-promise husky lint-staged prettier ${devInstall} ${forceCMD}`,
    {
      stdio: "inherit",
    }
  );
};

const angularPackagesInstallCmd = ({ install, devInstall, forceCMD }) => {
  execSync(
    `${install} @types/node eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin @angular-eslint/builder @angular-eslint/eslint-plugin @angular-eslint/eslint-plugin-template @angular-eslint/schematics @angular-eslint/template-parser husky lint-staged prettier ${devInstall} ${forceCMD}`,
    {
      stdio: "inherit",
    }
  );
};

const reactEslintConfigCmd = () => {
  const configPath = resolve(__dirname, `./config/react/.eslintrc.json`);
  const configPathForPrettier = resolve(
    __dirname,
    `./config/react/.prettierrc.json`
  );
  const configPathForLintStage = resolve(
    __dirname,
    `./config/react/.lintstagedrc.json`
  );

  copyFileSync(configPath, ".eslintrc.json");
  copyFileSync(configPathForPrettier, ".prettierrc.json");
  copyFileSync(configPathForLintStage, ".lintstagedrc.json");
};

const nestEslintConfigCmd = () => {
  const configPathForLint = resolve(__dirname, `./config/nestjs/.eslintrc.js`);
  const configPathForPrettier = resolve(
    __dirname,
    `./config/nestjs/.prettierrc`
  );
  const configPathForLintStage = resolve(
    __dirname,
    `./config/nestjs/.lintstagedrc.json`
  );
  copyFileSync(configPathForLint, ".eslintrc.js");
  copyFileSync(configPathForPrettier, ".prettierrc");
  copyFileSync(configPathForLintStage, ".lintstagedrc.json");
};

const angularEslintConfigCmd = () => {
  const configPath = resolve(__dirname, `./config/angular/.eslintrc.json`);
  const configPathForPrettier = resolve(
    __dirname,
    `./config/angular/.prettierrc.json`
  );
  const configPathForLintStage = resolve(
    __dirname,
    `./config/angular/.lintstagedrc.json`
  );

  copyFileSync(configPath, ".eslintrc.json");
  copyFileSync(configPathForPrettier, ".prettierrc.json");
  copyFileSync(configPathForLintStage, ".lintstagedrc.json");
};

const packagesInstallCmds = {
  react: reactPackagesInstallCmd,
  nestjs: nestPackagesInstallCmd,
  angular: angularPackagesInstallCmd,
};

const eslintConfigCmds = {
  react: reactEslintConfigCmd,
  nestjs: nestEslintConfigCmd,
  angular: angularEslintConfigCmd,
};

async function init() {
  const packageManager = await select({
    message: "Select a package manager",
    choices: [
      {
        name: "npm",
        value: "npm",
      },
      {
        name: "yarn",
        value: "yarn",
      },
      {
        name: "pnpm",
        value: "pnpm",
      },
    ],
  });

  const technology = await select({
    message: "Select a technology",
    choices: [
      {
        name: "Nextjs",
        value: "react",
      },
      {
        name: "Angular",
        value: "angular",
      },
      {
        name: "NestJs",
        value: "nestjs",
      },
    ],
  });

  const isForceCmd = process?.argv.some((arg) => arg === "--force");

  const commandsForPackageManager = {
    npm: {
      install: "npm install",
      devInstall: "--save-dev",
      uninstall: "npm uninstall",
    },
    yarn: {
      install: "yarn add",
      devInstall: "--dev",
      uninstall: "yarn remove",
    },
    pnpm: {
      install: "pnpm add",
      devInstall: "--save-dev",
      uninstall: "pnpm remove",
    },
  };

  const forceCMD = isForceCmd ? "--force" : "";
  const { install, uninstall, devInstall } =
    commandsForPackageManager[packageManager];

  const installRequiredPackages = packagesInstallCmds[technology];

  console.log("Installing required plugins...");
  installRequiredPackages({ install, forceCMD, devInstall });

  const eslintRunCmds = {
    react: 'next lint --fix',
    nestjs: 'npm run lint',
    angular: 'ng lint',
  };

  execSync(`npm pkg set scripts.lint="${eslintRunCmds[technology]}`, {
    stdio: "inherit",
  });

  console.log("Required plugins installed successfully.");

  console.log("Adding husky script");
  execSync(`npm pkg set scripts.prepare="husky install`, {
    stdio: "inherit",
  });

  console.log("Running husky script");
  execSync(`npm run prepare`, {
    stdio: "inherit",
  });

  execSync(`npm pkg delete scripts.prepare`, {
    stdio: "inherit",
  });

  const configNames = [".gitattributes", ".prettierignore"];

  console.log("Coping configuration files");
  const eslintConfigCmd = eslintConfigCmds[technology];

  eslintConfigCmd();

  configNames.forEach((configName) => {
    const configPath = resolve(__dirname, `./config/common/${configName}`);
    copyFileSync(configPath, configName);
  });

  const preCommitConfigPath = resolve(__dirname, "./config/common/pre-commit");
  copyFileSync(preCommitConfigPath, "./.husky/pre-commit");

  mkdir("./.vscode", () => { });

  const vscodeConfigPath = resolve(__dirname, "./config/common/settings.json");
  const vscodeExtensionsPath = resolve(
    __dirname,
    "./config/common/extensions.json"
  );
  copyFileSync(vscodeConfigPath, "./.vscode/settings.json");
  copyFileSync(vscodeExtensionsPath, "./.vscode/extensions.json");

  console.log("configuration files copied successfully.");

  execSync(`${uninstall} ${packageName} ${forceCMD}`, {
    stdio: "inherit",
  });
  console.log("Configuration completed successfully.");
}

const cmds = {
  init,
};

try {
  const [, , cmd] = process.argv;
  cmds[cmd] ? cmds[cmd]() : help(0);
} catch (error) {
  console.error("Configuration failed:", error);
  process.exit(1);
}
