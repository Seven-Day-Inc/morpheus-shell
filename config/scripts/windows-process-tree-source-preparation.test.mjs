import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repairWindowsProcessTreeBuildSources } from './windows-process-tree-source-preparation.mjs'

describe('windows-process-tree source preparation', () => {
  it('repairs an un-applied patch before a native rebuild', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'orca-windows-process-tree-source-'))
    try {
      const nodeAddonApiDir = join(packageDir, 'node_modules', 'node-addon-api')
      mkdirSync(nodeAddonApiDir, { recursive: true })
      mkdirSync(join(packageDir, 'src'), { recursive: true })
      writeFileSync(join(packageDir, 'package.json'), '{"name":"windows-process-tree"}\n')
      writeFileSync(join(nodeAddonApiDir, 'package.json'), '{"name":"node-addon-api"}\n')
      for (const header of ['napi.h', 'napi-inl.h', 'napi-inl.deprecated.h']) {
        writeFileSync(join(nodeAddonApiDir, header), `// ${header}\n`)
      }
      writeFileSync(
        join(packageDir, 'binding.gyp'),
        String.raw`{
  "dependencies": [
    "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except",
  ],
  "include_dirs": [],
  "msvs_configuration_attributes": {
    "SpectreMitigation": "Spectre"
  },
  "VCCLCompilerTool": {
  }
}\n`
      )
      writeFileSync(
        join(packageDir, 'src', 'process.cc'),
        'while (process_count < 1024 && Process32Next(snapshot_handle, &process_entry));\n'
      )

      expect(repairWindowsProcessTreeBuildSources(packageDir)).toBe(true)

      const bindingGyp = readFileSync(join(packageDir, 'binding.gyp'), 'utf8')
      expect(bindingGyp).not.toContain('SpectreMitigation')
      expect(bindingGyp).not.toContain('node_addon_api_except')
      expect(bindingGyp).toContain('"include_dirs": ["deps/node-addon-api"]')
      expect(bindingGyp).toContain('"ExceptionHandling": 1')
      expect(readFileSync(join(packageDir, 'src', 'process.cc'), 'utf8')).not.toContain(
        'process_count < 1024'
      )
      expect(existsSync(join(packageDir, 'deps', 'node-addon-api', 'napi.h'))).toBe(true)
      expect(repairWindowsProcessTreeBuildSources(packageDir)).toBe(false)
    } finally {
      rmSync(packageDir, { recursive: true, force: true })
    }
  })
})
