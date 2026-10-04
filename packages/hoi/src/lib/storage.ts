export interface Settings {
  githubToken: string
  projectUrl: string
}

const STORAGE_KEY = 'hoi-settings'

const defaultSettings: Settings = {
  githubToken: '',
  projectUrl: '',
}

export const getSettings = async (): Promise<Settings> => {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  return { ...defaultSettings, ...(result[STORAGE_KEY] as Partial<Settings>) }
}

export const saveSettings = async (settings: Settings): Promise<void> => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings })
}

export const parseProjectUrl = (
  url: string,
): { owner: string; number: number; type: 'user' | 'org' } | null => {
  // https://github.com/users/username/projects/1
  // https://github.com/orgs/orgname/projects/1
  const userMatch = url.match(/github\.com\/users\/([^/]+)\/projects\/(\d+)/)
  if (userMatch) {
    return { owner: userMatch[1], number: parseInt(userMatch[2], 10), type: 'user' }
  }

  const orgMatch = url.match(/github\.com\/orgs\/([^/]+)\/projects\/(\d+)/)
  if (orgMatch) {
    return { owner: orgMatch[1], number: parseInt(orgMatch[2], 10), type: 'org' }
  }

  return null
}
