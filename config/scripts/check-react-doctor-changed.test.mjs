import { describe, expect, it } from 'vitest'
import {
  buildReactDoctorArgs,
  buildReactDoctorEnvironment,
  chunkReactDoctorChangedFiles
} from './check-react-doctor-changed.mjs'

describe('changed-line React Doctor batching', () => {
  it('keeps every changed path while bounding batch size', () => {
    const files = ['one.tsx', 'two.tsx', 'three.tsx', 'four.tsx', 'five.tsx']

    expect(chunkReactDoctorChangedFiles(files, { maxFiles: 2, maxArgumentChars: 1_000 })).toEqual([
      ['one.tsx', 'two.tsx'],
      ['three.tsx', 'four.tsx'],
      ['five.tsx']
    ])
  })

  it('keeps React Doctor git argv below the platform budget', () => {
    const files = ['short.tsx', 'longer-component-name.tsx', 'last.tsx']

    expect(chunkReactDoctorChangedFiles(files, { maxFiles: 10, maxArgumentChars: 30 })).toEqual([
      ['short.tsx'],
      ['longer-component-name.tsx'],
      ['last.tsx']
    ])
  })

  it('pins each batch to the requested base and changed-file list', () => {
    expect(buildReactDoctorArgs('base-sha', '/tmp/changed-files.txt')).toEqual(
      expect.arrayContaining([
        '--base',
        'base-sha',
        '--changed-files-from',
        '/tmp/changed-files.txt'
      ])
    )
    expect(buildReactDoctorEnvironment({ CI: 'true' }, 'base-sha')).toMatchObject({
      CI: 'true',
      REACT_DOCTOR_BASE_SHA: 'base-sha',
      REACT_DOCTOR_LINT_PHASE_TIMEOUT_MS: '900000'
    })
  })
})
