import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const BUILD_INPUTS = ['binding.gyp', 'src', 'deps']

export function rebuildWindowsProcessTreeForElectron({
  projectDir,
  packageDir,
  electronVersion,
  arch
}) {
  const stagingRoot = mkdtempSync(join(tmpdir(), 'orca-windows-process-tree-'))
  const stagingPackageDir = join(stagingRoot, 'package')
  try {
    copyWindowsProcessTreeBuildInputs(packageDir, stagingPackageDir)
    execFileSync(
      process.execPath,
      createWindowsProcessTreeNodeGypArgs({
        projectDir,
        electronVersion,
        arch
      }),
      {
        cwd: stagingPackageDir,
        stdio: 'inherit'
      }
    )
    copyWindowsProcessTreeArtifact(stagingPackageDir, packageDir)
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
}

export function createWindowsProcessTreeNodeGypArgs({ projectDir, electronVersion, arch }) {
  const electronRebuildRequire = createRequire(
    join(projectDir, 'node_modules', '@electron', 'rebuild', 'package.json')
  )
  return [
    electronRebuildRequire.resolve('node-gyp/bin/node-gyp.js'),
    'rebuild',
    '--runtime=electron',
    `--target=${electronVersion}`,
    `--arch=${arch}`,
    '--dist-url=https://www.electronjs.org/headers',
    `--devdir=${join(homedir(), '.electron-gyp')}`,
    '--build-from-source',
    '--silent'
  ]
}

export function copyWindowsProcessTreeBuildInputs(packageDir, stagingPackageDir) {
  mkdirSync(stagingPackageDir, { recursive: true })
  for (const input of BUILD_INPUTS) {
    const sourcePath = join(packageDir, input)
    const targetPath = join(stagingPackageDir, input)
    if (!existsSync(sourcePath)) {
      throw new Error(`windows-process-tree build input is missing: ${sourcePath}`)
    }
    cpSync(sourcePath, targetPath, { recursive: true })
  }
}

function copyWindowsProcessTreeArtifact(stagingPackageDir, packageDir) {
  const artifactName = 'windows_process_tree.node'
  const sourcePath = join(stagingPackageDir, 'build', 'Release', artifactName)
  if (!existsSync(sourcePath)) {
    throw new Error(`windows-process-tree rebuild produced no artifact: ${sourcePath}`)
  }
  const targetDir = join(packageDir, 'build', 'Release')
  mkdirSync(targetDir, { recursive: true })
  copyFileSync(sourcePath, join(targetDir, artifactName))
}
