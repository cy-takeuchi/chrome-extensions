import { KintoneRestAPIClient } from '@kintone/rest-api-client'

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`)
  }
  return value
}

export const createKintoneClient = () => {
  return new KintoneRestAPIClient({
    baseUrl: getEnv('KINTONE_URL'),
    auth: {
      username: getEnv('KINTONE_USERNAME1'),
      password: getEnv('KINTONE_PASSWORD1'),
    },
  })
}

export const createKintoneClient2 = () => {
  return new KintoneRestAPIClient({
    baseUrl: getEnv('KINTONE_URL'),
    auth: {
      username: getEnv('KINTONE_USERNAME2'),
      password: getEnv('KINTONE_PASSWORD2'),
    },
  })
}

export type KintoneClient = ReturnType<typeof createKintoneClient>

export const getKintoneUrl = () => getEnv('KINTONE_URL')
export const getKintoneUsername1 = () => getEnv('KINTONE_USERNAME1')
export const getKintoneUsername2 = () => getEnv('KINTONE_USERNAME2')
export const getSpaceTemplateId = () => Number(process.env.KINTONE_SPACE_TEMPLATE_ID || '12')

/**
 * Wait for app deployment to complete
 */
export const waitForAppDeployment = async (
  client: KintoneClient,
  apps: { app: string }[],
): Promise<void> => {
  const maxWaitTime = 30000
  const interval = 1000
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const status = await client.app.getDeployStatus({ apps: apps.map((a) => a.app) })
    const allDeployed = status.apps.every((app) => app.status === 'SUCCESS')

    if (allDeployed) {
      return
    }

    const hasFailed = status.apps.some((app) => app.status === 'FAIL')
    if (hasFailed) {
      throw new Error('App deployment failed')
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error('App deployment timed out')
}
