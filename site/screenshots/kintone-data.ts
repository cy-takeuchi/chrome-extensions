import { KintoneRestAPIClient } from '@kintone/rest-api-client'

const env = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Environment variable ${key} is not set`)
  return value
}

export const baseUrl = () => env('KINTONE_URL')

export const users = () => ({
  user1: { username: env('KINTONE_USERNAME1'), password: env('KINTONE_PASSWORD1') },
  user2: { username: env('KINTONE_USERNAME2'), password: env('KINTONE_PASSWORD2') },
})

const client = (user: { username: string; password: string }) =>
  new KintoneRestAPIClient({ baseUrl: baseUrl(), auth: user })

export interface SampleData {
  spaceId: string
  threadId: string
  threadComment: string
  appId: string
  recordId: string
  /** 画面に出る実在のユーザー名とログイン名 */
  people: { name: string; code: string }[]
}

const waitForDeploy = async (c: KintoneRestAPIClient, app: string) => {
  for (let i = 0; i < 30; i++) {
    const { apps } = await c.app.getDeployStatus({ apps: [app] })
    if (apps.every((a) => a.status === 'SUCCESS')) return
    if (apps.some((a) => a.status === 'FAIL')) throw new Error('App deployment failed')
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('App deployment timed out')
}

/**
 * スクリーンショット用のスペース・スレッド・アプリ・レコード・コメントを作る。
 * 見積もり案件をやり取りしている営業チームという想定。
 */
export const createSampleData = async (): Promise<SampleData> => {
  const { user1, user2 } = users()
  const c1 = client(user1)
  const c2 = client(user2)

  const { id: spaceId } = await c1.space.addSpaceFromTemplate({
    id: Number(process.env.KINTONE_SPACE_TEMPLATE_ID || '1'),
    name: '営業部',
    members: [
      { entity: { type: 'USER', code: user1.username }, isAdmin: true },
      { entity: { type: 'USER', code: user2.username }, isAdmin: false },
    ],
  })
  const { defaultThread: threadId } = await c1.space.getSpace({ id: spaceId })
  await c1.space.updateThread({ id: threadId, name: '見積もり相談' })

  await c1.space.addThreadComment({
    space: spaceId,
    thread: threadId,
    comment: { text: '来週の打ち合わせ資料をアップしました。目を通しておいてください。' },
  })
  const threadComment =
    '株式会社サンプルの見積もりの件、先方から納期を 2 週間前倒しできないかと相談がありました。\n対応できるか確認して、今週中に回答をお願いします。'
  await c2.space.addThreadComment({
    space: spaceId,
    thread: threadId,
    comment: { text: threadComment, mentions: [{ code: user1.username, type: 'USER' }] },
  })

  const { app: appId } = await c1.app.addApp({ name: '案件管理', space: spaceId })
  await c1.app.addFormFields({
    app: appId,
    properties: {
      title: { type: 'SINGLE_LINE_TEXT', code: 'title', label: '案件名' },
      customer: { type: 'SINGLE_LINE_TEXT', code: 'customer', label: '顧客名' },
      owner: { type: 'USER_SELECT', code: 'owner', label: '担当者' },
      due: { type: 'DATE', code: 'due', label: '受注予定日' },
      amount: { type: 'NUMBER', code: 'amount', label: '金額', unit: '円', unitPosition: 'AFTER' },
      summary: { type: 'RICH_TEXT', code: 'summary', label: '概要' },
      items: {
        type: 'SUBTABLE',
        code: 'items',
        label: '明細',
        fields: {
          item: { type: 'SINGLE_LINE_TEXT', code: 'item', label: '品名' },
          quantity: { type: 'NUMBER', code: 'quantity', label: '数量' },
          price: {
            type: 'NUMBER',
            code: 'price',
            label: '単価',
            unit: '円',
            unitPosition: 'AFTER',
          },
        },
      },
      files: { type: 'FILE', code: 'files', label: '添付ファイル' },
    },
  })
  await c1.app.deployApp({ apps: [{ app: appId }] })
  await waitForDeploy(c1, appId)

  const upload = (name: string, data: string) => c1.file.uploadFile({ file: { name, data } })
  const files = await Promise.all([
    upload('見積書.txt', '見積書（サンプル）'),
    upload('仕様書.txt', '仕様書（サンプル）'),
  ])
  const { id: recordId } = await c1.record.addRecord({
    app: appId,
    record: {
      title: { value: '業務システム導入支援' },
      customer: { value: '株式会社サンプル' },
      owner: { value: [{ code: user1.username }] },
      due: { value: '2026-11-30' },
      amount: { value: '1200000' },
      summary: {
        value:
          '<div>既存の Excel 管理を kintone に移行する。</div><div><b>11 月中の稼働</b>を希望されている。</div>',
      },
      items: {
        value: [
          {
            value: {
              item: { value: '要件定義' },
              quantity: { value: '1' },
              price: { value: '400000' },
            },
          },
          {
            value: {
              item: { value: 'アプリ構築' },
              quantity: { value: '1' },
              price: { value: '600000' },
            },
          },
          {
            value: {
              item: { value: '操作研修' },
              quantity: { value: '2' },
              price: { value: '100000' },
            },
          },
        ],
      },
      files: { value: files.map(({ fileKey }) => ({ fileKey })) },
    },
  })

  await client(user2).record.addRecordComment({
    app: appId,
    record: recordId,
    comment: { text: '金額を最新の見積もりに更新しました。ご確認ください。' },
  })
  await c1.record.addRecordComment({
    app: appId,
    record: recordId,
    comment: { text: '確認しました。明日、先方に送付します。' },
  })

  // 画面に出るユーザー名は、コメントの投稿者から取る
  const { comments } = await c1.record.getRecordComments({ app: appId, record: recordId })
  const people = [...new Map(comments.map((cm) => [cm.creator.code, cm.creator])).values()]

  return { spaceId: String(spaceId), threadId, threadComment, appId, recordId, people }
}

export const deleteSampleData = async (data: Pick<SampleData, 'spaceId'>) => {
  await client(users().user1).space.deleteSpace({ id: data.spaceId })
}
