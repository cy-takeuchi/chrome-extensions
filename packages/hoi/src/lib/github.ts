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
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const json: GraphQLResponse<T> = await response.json()

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message)
  }

  if (!json.data) {
    throw new Error('No data returned from GitHub API')
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

interface UserProjectResponse {
  user: {
    projectV2: {
      id: string
    }
  }
}

interface OrgProjectResponse {
  organization: {
    projectV2: {
      id: string
    }
  }
}

export const getProjectId = async (
  token: string,
  owner: string,
  projectNumber: number,
  type: 'user' | 'org',
): Promise<string> => {
  if (type === 'user') {
    const query = `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
          }
        }
      }
    `
    const data = await graphql<UserProjectResponse>(token, query, { owner, number: projectNumber })
    return data.user.projectV2.id
  } else {
    const query = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
          }
        }
      }
    `
    const data = await graphql<OrgProjectResponse>(token, query, { owner, number: projectNumber })
    return data.organization.projectV2.id
  }
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
