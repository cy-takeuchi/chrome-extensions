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
  const match = url.match(/github\.com\/(users|orgs)\/([^/]+)\/projects\/(\d+)/)
  if (!match) return null

  return {
    owner: match[2],
    number: parseInt(match[3], 10),
    type: match[1] === 'users' ? 'user' : 'org',
  }
}
