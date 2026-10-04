import { describe, expect, it } from 'vitest'
import { parseProjectUrl } from './storage'

describe('parseProjectUrl', () => {
  it('ユーザーの Project', () => {
    expect(parseProjectUrl('https://github.com/users/alice/projects/1')).toEqual({
      owner: 'alice',
      number: 1,
      type: 'user',
    })
  })

  it('Organization の Project（ビューの URL でもよい）', () => {
    expect(parseProjectUrl('https://github.com/orgs/acme/projects/12/views/3')).toEqual({
      owner: 'acme',
      number: 12,
      type: 'org',
    })
  })

  it('Project 以外の URL は null', () => {
    expect(parseProjectUrl('https://github.com/acme/repo')).toBeNull()
    expect(parseProjectUrl('')).toBeNull()
  })
})
