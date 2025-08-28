import { __test_parseDateLoose } from '@/modules/rag'

describe('RAG date parsing', () => {
  test('parses month-name formats', () => {
    expect(__test_parseDateLoose('Oct 12, 2025')).toBe('2025-10-12')
    expect(__test_parseDateLoose('November 3rd')).toMatch(/-11-03$/)
  })

  test('rejects bare numeric without context', () => {
    expect(__test_parseDateLoose('03/04')).toBeNull()
  })

  test('accepts numeric with context', () => {
    const d = __test_parseDateLoose('Exam on 03/04')
    expect(d).not.toBeNull()
  })
})


