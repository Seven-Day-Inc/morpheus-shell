import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyWindowsProcessTreeBuildInputs } from './windows-process-tree-electron-rebuild.mjs'

describe('windows-process-tree Electron rebuild', () => {
  it('stages only the repaired native build inputs in a short directory', () => {
    const sourceDir = mkdtempSync(join(tmpdir(), 'orca-windows-process-tree-source-'))
    const stagingDir = mkdtempSync(join(tmpdir(), 'orca-windows-process-tree-stage-'))
    try {
      mkdirSync(join(sourceDir, 'src'), { recursive: true })
      mkdirSync(join(sourceDir, 'deps', 'node-addon-api'), { recursive: true })
      writeFileSync(join(sourceDir, 'binding.gyp'), '{"targets": []}\n')
      writeFileSync(join(sourceDir, 'src', 'process.cc'), '// repaired source\n')
      writeFileSync(join(sourceDir, 'deps', 'node-addon-api', 'napi.h'), '// header\n')
      writeFileSync(join(sourceDir, 'README.md'), 'not a build input\n')

      copyWindowsProcessTreeBuildInputs(sourceDir, stagingDir)

      expect(readFileSync(join(stagingDir, 'binding.gyp'), 'utf8')).toContain('targets')
      expect(readFileSync(join(stagingDir, 'src', 'process.cc'), 'utf8')).toContain('repaired')
      expect(existsSync(join(stagingDir, 'deps', 'node-addon-api', 'napi.h'))).toBe(true)
      expect(existsSync(join(stagingDir, 'README.md'))).toBe(false)
    } finally {
      rmSync(sourceDir, { recursive: true, force: true })
      rmSync(stagingDir, { recursive: true, force: true })
    }
  })
})
