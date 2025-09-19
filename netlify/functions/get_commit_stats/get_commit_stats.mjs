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

    console.log(`Fetching commit stats for ${username} from ${startDate} to ${endDate}`);

    // Get repositories that have commits by the user in the specified date range
    console.log("Searching for repositories with commits in date range...");
    const repositories = await getRepositoriesWithCommitsInDateRange(access_token, username, startDate, endDate);
    console.log(`Found ${repositories.length} repositories with commits in the time window`);

    // Aggregate commit data across relevant repositories
    const allCommits = [];
    const processedRepos = [];

    // Calculate date range to adjust processing limits
    const dateRangeMs = new Date(endDate) - new Date(startDate);
    const daysInRange = dateRangeMs / (1000 * 60 * 60 * 24);

    // Reduce limits for longer time ranges to prevent timeout
    const maxRepos = daysInRange > 90 ? 10 : (daysInRange > 30 ? 15 : 20);
    const maxCommitsPerRepo = daysInRange > 90 ? 50 : (daysInRange > 30 ? 100 : 200);

    console.log(`Date range: ${daysInRange.toFixed(0)} days. Processing up to ${maxRepos} repos, ${maxCommitsPerRepo} commits per repo.`);

    for (const repo of repositories.slice(0, maxRepos)) {
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

        // Get file changes for each commit
        for (const commit of commitsToProcess) {
          try {
            const fileChanges = await getCommitFileChanges(
              access_token,
              repo.owner.login,
              repo.name,
              commit.oid
            );

            const commitData = {
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

            allCommits.push(commitData);
          } catch (error) {
            console.warn(`Failed to get file changes for commit ${commit.oid}:`, error.message);
          }
        }

        processedRepos.push({
          name: repo.name,
          owner: repo.owner.login,
          commitCount: commits.length,
          processedCommits: commitsToProcess.length
        });

      } catch (error) {
        console.warn(`Failed to process repository ${repo.name}:`, error.message);
      }
    }

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

