import test from 'node:test'
import assert from 'node:assert/strict'

import { renderContext } from '../context.js'

test('renders the root, the links, and the search/sandbox guidance', () => {
  const text = renderContext(
    { name: 'demo', path: 'C:\\ws\\demo', links: [{ alias: 'repo', target: 'D:\\repo' }] },
    '_roots',
  )
  assert.ok(text.includes('Managed workspace "demo"'))
  assert.ok(text.includes('Root: "C:\\ws\\demo"'))
  assert.ok(text.includes('- "repo" -> "D:\\repo"'))
  assert.ok(text.includes('_roots/<alias>'))
  assert.ok(text.includes('danger-full-access'))
  assert.ok(!text.includes('undefined'))
})

test('renders the no-links case without link-specific guidance', () => {
  const text = renderContext({ name: 'demo', path: 'C:\\ws\\demo', links: [] }, '_roots')
  assert.ok(text.includes('Linked folders: none.'))
  assert.ok(!text.includes('danger-full-access'))
  assert.ok(!text.includes('undefined'))
})
