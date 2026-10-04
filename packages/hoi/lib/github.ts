const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

const graphql = async <T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`GitHub API エラー: HTTP ${response.status}`)
  }

  const json: GraphQLResponse<T> = await response.json()

  const [firstError] = json.errors ?? []
  if (firstError) {
    throw new Error(firstError.message)
  }

  if (!json.data) {
    throw new Error('GitHub API からデータが返りませんでした')
  }

  return json.data
}

interface ViewerResponse {
  viewer: {
    id: string
    login: string
  }
}

export const getViewer = async (token: string): Promise<{ id: string; login: string }> => {
  const query = `
    query {
      viewer {
        id
        login
      }
    }
  `
  const data = await graphql<ViewerResponse>(token, query)
  return data.viewer
}

type ProjectOwnerType = 'user' | 'org'

// GraphQL のルートフィールド名は user / organization
const OWNER_FIELD = { user: 'user', org: 'organization' } as const satisfies Record<
  ProjectOwnerType,
  string
>

type ProjectResponse = Record<string, { projectV2: { id: string } }>

export const getProjectId = async (
  token: string,
  owner: string,
  projectNumber: number,
  type: ProjectOwnerType,
): Promise<string> => {
  const field = OWNER_FIELD[type]
  const query = `
    query($owner: String!, $number: Int!) {
      ${field}(login: $owner) {
        projectV2(number: $number) {
          id
        }
      }
    }
  `
  const data = await graphql<ProjectResponse>(token, query, { owner, number: projectNumber })
  const project = data[field]?.projectV2
  if (!project) {
    throw new Error(`Project が見つかりません: ${owner}/${projectNumber}`)
  }
  return project.id
}

interface AddDraftIssueResponse {
  addProjectV2DraftIssue: {
    projectItem: {
      id: string
    }
  }
}

export const addDraftIssue = async (
  token: string,
  projectId: string,
  title: string,
  body: string,
  assigneeIds?: string[],
): Promise<string> => {
  const query = `
    mutation($projectId: ID!, $title: String!, $body: String, $assigneeIds: [ID!]) {
      addProjectV2DraftIssue(input: {
        projectId: $projectId
        title: $title
        body: $body
        assigneeIds: $assigneeIds
      }) {
        projectItem {
          id
        }
      }
    }
  `
  const data = await graphql<AddDraftIssueResponse>(token, query, {
    projectId,
    title,
    body: body || null,
    assigneeIds: assigneeIds && assigneeIds.length > 0 ? assigneeIds : null,
  })
  return data.addProjectV2DraftIssue.projectItem.id
}
