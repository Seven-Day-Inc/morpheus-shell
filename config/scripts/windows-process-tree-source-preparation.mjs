import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const NODE_ADDON_API_HEADERS = ['napi.h', 'napi-inl.h', 'napi-inl.deprecated.h']
const GYP_ESCAPED_QUOTE = '\\' + '"'

// pnpm can materialize this CRLF package without applying its patch.
export function repairWindowsProcessTreeBuildSources(packageDir) {
  const bindingPath = join(packageDir, 'binding.gyp')
  const processPath = join(packageDir, 'src', 'process.cc')
  const nodeAddonApiDir = dirname(
    createRequire(join(packageDir, 'package.json')).resolve('node-addon-api/package.json')
  )
  const stagedHeaderDir = join(packageDir, 'deps', 'node-addon-api')
  let bindingGyp = readFileSync(bindingPath, 'utf8')
  let processCc = readFileSync(processPath, 'utf8')
  const originalBinding = bindingGyp
  const originalProcess = processCc

  for (const dynamicDependency of [
    `<!(node -p ${GYP_ESCAPED_QUOTE}require('node-addon-api').targets${GYP_ESCAPED_QUOTE}):node_addon_api_except`,
    `<!(node -p ${GYP_ESCAPED_QUOTE}require.resolve('node-addon-api/node_addon_api.gyp')${GYP_ESCAPED_QUOTE}):node_addon_api_except`,
    '../../node-addon-api/node_addon_api.gyp:node_addon_api_except'
  ]) {
    bindingGyp = bindingGyp.replace(`"${dynamicDependency}",`, '')
  }
  bindingGyp = bindingGyp.replace(
    '"include_dirs": []',
    '"include_dirs": ["deps/node-addon-api"],\n          "defines": ["NAPI_CPP_EXCEPTIONS", "_HAS_EXCEPTIONS=1"]'
  )
  if (!bindingGyp.includes('"ExceptionHandling": 1')) {
    bindingGyp = bindingGyp.replace(
      '"VCCLCompilerTool": {',
      '"VCCLCompilerTool": {\n              "ExceptionHandling": 1,'
    )
  }
  bindingGyp = bindingGyp.replace(
    /\r?\n\s*"msvs_configuration_attributes": \{\s*"SpectreMitigation": "Spectre"\s*\},?/s,
    ''
  )
  processCc = processCc.replace(/process_count < 1024 && /, '')

  if (bindingGyp !== originalBinding) {
    writeFileSync(bindingPath, bindingGyp)
  }
  if (processCc !== originalProcess) {
    writeFileSync(processPath, processCc)
  }
  mkdirSync(stagedHeaderDir, { recursive: true })
  for (const header of NODE_ADDON_API_HEADERS) {
    copyFileSync(join(nodeAddonApiDir, header), join(stagedHeaderDir, header))
  }
  return bindingGyp !== originalBinding || processCc !== originalProcess
}
