import { getUserRepositories, getRepositoriesWithCommitsInDateRange, getCommitHistory, getCommitFileChanges } from '../utils/github-graphql.mjs';
import { detectLanguage, groupFilesByLanguage } from '../utils/language-detector.mjs';

export async function handler(event) {
  console.log("=== Get Commit Stats Request ===");
  console.log("Query Parameters:", event.queryStringParameters);

  const { access_token, start_date, end_date, username } = event.queryStringParameters || {};

  if (!access_token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing access_token parameter" }),
    };
  }

  if (!username) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing username parameter" }),
    };
  }

  if (!start_date || !end_date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing start_date or end_date parameter" }),
    };
  }

  try {
    const startDate = new Date(start_date).toISOString();
    const endDate = new Date(end_date).toISOString();

    // Validate date range - maximum 1 year
    const dateRangeMs = new Date(endDate) - new Date(startDate);
    const daysInRange = dateRangeMs / (1000 * 60 * 60 * 24);
    const maxDays = 365;

    if (daysInRange > maxDays) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: `Time window too large. Maximum allowed is ${maxDays} days, but ${Math.round(daysInRange)} days were requested. Please use a shorter date range.`
        })
      };
    }

    if (daysInRange <= 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: "Invalid date range. Start date must be before end date."
        })
      };
    }

    console.log(`Fetching commit stats for ${username} from ${startDate} to ${endDate}`);

    // Get repositories that have commits by the user in the specified date range
    console.log("Searching for repositories with commits in date range...");
    const repositories = await getRepositoriesWithCommitsInDateRange(access_token, username, startDate, endDate);
    console.log(`Found ${repositories.length} repositories with commits in the time window`);

    // Aggregate commit data across relevant repositories
    const allCommits = [];
    const processedRepos = [];

    // Reduce limits for longer time ranges to prevent timeout
    const maxRepos = daysInRange > 90 ? 10 : (daysInRange > 30 ? 15 : 20);
    const maxCommitsPerRepo = daysInRange > 90 ? 50 : (daysInRange > 30 ? 100 : 200);

    console.log(`Date range: ${daysInRange.toFixed(0)} days. Processing up to ${maxRepos} repos, ${maxCommitsPerRepo} commits per repo.`);

    // Process repositories in parallel with concurrency limit
    const processRepository = async (repo) => {
      try {
        console.log(`Processing ${repo.owner.login}/${repo.name}...`);

        const commits = await getCommitHistory(
          access_token,
          username,
          repo.owner.login,
          repo.name,
          startDate,
          endDate
        );

        console.log(`Found ${commits.length} commits in ${repo.name}`);

        // Limit commits per repo for large time ranges
        const commitsToProcess = commits.slice(0, maxCommitsPerRepo);
        if (commitsToProcess.length < commits.length) {
          console.log(`Limited to processing ${commitsToProcess.length} of ${commits.length} commits for ${repo.name}`);
        }

        // Process commits in parallel batches for this repository
        const batchSize = 5; // Process 5 commits at a time to avoid rate limits
        const repoCommits = [];

        for (let i = 0; i < commitsToProcess.length; i += batchSize) {
          const batch = commitsToProcess.slice(i, i + batchSize);

          const batchPromises = batch.map(async (commit) => {
            try {
              const fileChanges = await getCommitFileChanges(
                access_token,
                repo.owner.login,
                repo.name,
                commit.oid
              );

              return {
                ...commit,
                repository: {
                  name: repo.name,
                  owner: repo.owner.login,
                  primaryLanguage: repo.primaryLanguage?.name
                },
                files: fileChanges.map(file => ({
                  filename: file.filename,
                  status: file.status,
                  additions: file.additions || 0,
                  deletions: file.deletions || 0,
                  changes: file.changes || 0,
                  language: detectLanguage(file.filename)
                }))
              };
            } catch (error) {
              console.warn(`Failed to get file changes for commit ${commit.oid}:`, error.message);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          repoCommits.push(...batchResults.filter(result => result !== null));
        }

        return {
          commits: repoCommits,
          repoInfo: {
            name: repo.name,
            owner: repo.owner.login,
            commitCount: commits.length,
            processedCommits: commitsToProcess.length
          }
        };

      } catch (error) {
        console.warn(`Failed to process repository ${repo.name}:`, error.message);
        return { commits: [], repoInfo: null };
      }
    };

    // Process repositories in parallel with concurrency limit
    const reposConcurrency = Math.min(3, maxRepos); // Process 3 repos at a time
    const repoResults = [];

    for (let i = 0; i < Math.min(repositories.length, maxRepos); i += reposConcurrency) {
      const batch = repositories.slice(i, i + reposConcurrency);
      const batchPromises = batch.map(processRepository);
      const batchResults = await Promise.all(batchPromises);
      repoResults.push(...batchResults);
    }

    // Collect all results
    repoResults.forEach(result => {
      allCommits.push(...result.commits);
      if (result.repoInfo) {
        processedRepos.push(result.repoInfo);
      }
    });

    console.log(`Total commits processed: ${allCommits.length}`);

    const response = {
      timeRange: {
        startDate,
        endDate
      },
      commits: allCommits, // Send raw commit data for client-side processing
      processedRepositories: processedRepos,
      totalCommits: allCommits.length,
      totalRepositories: processedRepos.length
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error("Error fetching commit stats:", error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: "Failed to fetch commit statistics",
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
}

