export async function executeGraphQLQuery(query, variables, accessToken) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Stats-App'
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

export function buildCommitsQuery(username, startDate, endDate, first = 100, after = null) {
  return `
    query GetUserCommits($username: String!, $startDate: DateTime!, $endDate: DateTime!, $first: Int!, $after: String) {
      user(login: $username) {
        contributionsCollection(from: $startDate, to: $endDate) {
          commitContributionsByRepository(maxRepositories: 100) {
            repository {
              name
              owner {
                login
              }
              isPrivate
              primaryLanguage {
                name
              }
            }
            contributions(first: $first, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                commitCount
                occurredAt
                user {
                  login
                }
              }
            }
          }
        }
      }
    }
  `;
}

export function buildCommitDetailsQuery(owner, repo, commitSha) {
  return `
    query GetCommitDetails($owner: String!, $repo: String!, $commitSha: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $commitSha) {
          ... on Commit {
            committedDate
            author {
              user {
                login
              }
            }
            message
            additions
            deletions
            changedFiles
          }
        }
      }
    }
  `;
}

export function buildRepositoryCommitsQuery(owner, repo, startDate, endDate, first = 100, after = null) {
  return `
    query GetRepositoryCommits($owner: String!, $repo: String!, $startDate: GitTimestamp!, $endDate: GitTimestamp!, $first: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: $first, after: $after, since: $startDate, until: $endDate) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  oid
                  committedDate
                  message
                  additions
                  deletions
                  changedFiles
                  author {
                    user {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}

export function buildUserRepositoriesQuery(username, first = 100, after = null) {
  return `
    query GetUserRepositories($username: String!, $first: Int!, $after: String) {
      user(login: $username) {
        repositories(first: $first, after: $after, ownerAffiliations: [OWNER, COLLABORATOR], orderBy: {field: PUSHED_AT, direction: DESC}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name
            owner {
              login
            }
            isPrivate
            primaryLanguage {
              name
            }
            pushedAt
            defaultBranchRef {
              name
            }
          }
        }
      }
    }
  `;
}

export async function getUserRepositories(accessToken, username) {
  const repositories = [];
  let hasNextPage = true;
  let after = null;

  while (hasNextPage) {
    const query = buildUserRepositoriesQuery(username, 100, after);
    const data = await executeGraphQLQuery(query, { username, first: 100, after }, accessToken);

    if (data.user?.repositories?.nodes) {
      repositories.push(...data.user.repositories.nodes);
      hasNextPage = data.user.repositories.pageInfo.hasNextPage;
      after = data.user.repositories.pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }

  return repositories;
}

export async function getRepositoriesWithCommitsInDateRange(accessToken, username, startDate, endDate) {
  const repositories = [];
  let page = 1;
  const perPage = 100;

  // Format dates for GitHub search (YYYY-MM-DD format)
  const startDateFormatted = new Date(startDate).toISOString().split('T')[0];
  const endDateFormatted = new Date(endDate).toISOString().split('T')[0];

  while (page <= 10) { // Limit to 10 pages
    try {
      // Use GitHub search API to find commits by user in date range
      const searchQuery = `author:${username} committer-date:${startDateFormatted}..${endDateFormatted}`;
      const url = new URL('https://api.github.com/search/commits');
      url.searchParams.set('q', searchQuery);
      url.searchParams.set('per_page', perPage.toString());
      url.searchParams.set('page', page.toString());
      url.searchParams.set('sort', 'committer-date');
      url.searchParams.set('order', 'desc');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.cloak-preview+json', // Required for commit search
          'User-Agent': 'GitHub-Stats-App'
        }
      });

      if (!response.ok) {
        console.warn(`Search API failed with status ${response.status}`);
        break;
      }

      const searchResults = await response.json();

      if (!searchResults.items || searchResults.items.length === 0) {
        break; // No more results
      }

      // Extract unique repositories from search results
      const repoMap = new Map();
      searchResults.items.forEach(commit => {
        const repo = commit.repository;
        if (repo && !repo.private) { // Only include public repos
          repoMap.set(repo.full_name, {
            name: repo.name,
            owner: { login: repo.owner.login },
            isPrivate: repo.private,
            primaryLanguage: { name: repo.language },
            pushedAt: repo.pushed_at,
            defaultBranchRef: { name: repo.default_branch }
          });
        }
      });

      repositories.push(...Array.from(repoMap.values()));

      // If we got fewer results than requested, we've reached the end
      if (searchResults.items.length < perPage) {
        break;
      }

      page++;
    } catch (error) {
      console.warn(`Failed to search commits:`, error.message);
      break;
    }
  }

  // Remove duplicates based on full name
  const uniqueRepos = Array.from(
    new Map(repositories.map(repo => [`${repo.owner.login}/${repo.name}`, repo])).values()
  );

  console.log(`Found ${uniqueRepos.length} repositories with commits in date range`);
  return uniqueRepos;
}

export async function getCommitHistory(accessToken, username, owner, repo, startDate, endDate) {
  const commits = [];
  let page = 1;
  const perPage = 100;

  while (page <= 10) { // Limit to 10 pages to avoid excessive API calls
    try {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
      url.searchParams.set('author', username);
      url.searchParams.set('since', startDate);
      url.searchParams.set('until', endDate);
      url.searchParams.set('per_page', perPage.toString());
      url.searchParams.set('page', page.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Stats-App'
        }
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Repository is empty or has no commits
          console.log(`Repository ${owner}/${repo} is empty or has no commits`);
          break;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const pageCommits = await response.json();

      if (pageCommits.length === 0) {
        break; // No more commits
      }

      // Transform to match our expected format
      const transformedCommits = pageCommits.map(commit => ({
        oid: commit.sha,
        committedDate: commit.commit.committer.date,
        message: commit.commit.message,
        additions: commit.stats?.additions || 0,
        deletions: commit.stats?.deletions || 0,
        changedFiles: commit.files?.length || 0,
        author: {
          user: {
            login: commit.author?.login || commit.commit.author.name
          }
        }
      }));

      commits.push(...transformedCommits);

      // If we got fewer commits than requested, we've reached the end
      if (pageCommits.length < perPage) {
        break;
      }

      page++;
    } catch (error) {
      console.warn(`Failed to fetch commits for ${owner}/${repo} (page ${page}):`, error.message);
      break;
    }
  }

  return commits;
}

export async function getCommitFileChanges(accessToken, owner, repo, commitSha) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Stats-App'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const commit = await response.json();
    return commit.files || [];
  } catch (error) {
    console.warn(`Failed to fetch file changes for commit ${commitSha}:`, error.message);
    return [];
  }
}