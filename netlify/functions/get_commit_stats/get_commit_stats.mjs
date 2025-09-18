import { getUserRepositories, getRepositoriesWithCommitsInDateRange, getCommitHistory, getCommitFileChanges } from '../utils/github-graphql.mjs';
import { detectLanguage, groupFilesByLanguage } from '../utils/language-detector.mjs';

export async function handler(event) {
  console.log("=== Get Commit Stats Request ===");
  console.log("Query Parameters:", event.queryStringParameters);

  const { access_token, start_date, end_date, username, time_period = 'daily' } = event.queryStringParameters || {};

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

    for (const repo of repositories.slice(0, 20)) { // Limit to first 20 repos to avoid timeout
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

        // Get file changes for each commit
        for (const commit of commits) {
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
          commitCount: commits.length
        });

      } catch (error) {
        console.warn(`Failed to process repository ${repo.name}:`, error.message);
      }
    }

    console.log(`Total commits processed: ${allCommits.length}`);

    const response = {
      timeRange: {
        startDate,
        endDate,
        timePeriod: time_period
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

function aggregateCommitsByTimeAndLanguage(commits, timePeriod) {
  const aggregated = {};

  commits.forEach(commit => {
    const date = new Date(commit.committedDate);
    const timeKey = getTimeKey(date, timePeriod);
    const repoName = `${commit.repository.owner}/${commit.repository.name}`;

    if (!aggregated[timeKey]) {
      aggregated[timeKey] = {
        date: timeKey,
        languages: {},
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        totalChanges: 0
      };
    }

    aggregated[timeKey].totalCommits++;

    commit.files.forEach(file => {
      const language = file.language;

      if (!aggregated[timeKey].languages[language]) {
        aggregated[timeKey].languages[language] = {
          additions: 0,
          deletions: 0,
          changes: 0,
          files: 0,
          repositories: new Map()
        };
      }

      const langData = aggregated[timeKey].languages[language];
      langData.additions += file.additions;
      langData.deletions += file.deletions;
      langData.changes += file.changes;
      langData.files++;

      // Track repository contributions for this language
      if (!langData.repositories.has(repoName)) {
        langData.repositories.set(repoName, {
          name: repoName,
          additions: 0,
          deletions: 0,
          changes: 0,
          files: 0,
          commits: new Set()
        });
      }

      const repoData = langData.repositories.get(repoName);
      repoData.additions += file.additions;
      repoData.deletions += file.deletions;
      repoData.changes += file.changes;
      repoData.files++;
      repoData.commits.add(commit.oid);

      aggregated[timeKey].totalAdditions += file.additions;
      aggregated[timeKey].totalDeletions += file.deletions;
      aggregated[timeKey].totalChanges += file.changes;
    });
  });

  // Convert repository Maps to arrays and commit Sets to counts
  Object.values(aggregated).forEach(timeData => {
    Object.values(timeData.languages).forEach(langData => {
      langData.repositories = Array.from(langData.repositories.values()).map(repo => ({
        ...repo,
        commits: repo.commits.size
      })).sort((a, b) => b.changes - a.changes);
    });
  });

  return Object.values(aggregated).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getTimeKey(date, timePeriod) {
  if (timePeriod === 'weekly') {
    const startOfWeek = new Date(date);
    // Set to Sunday (start of week) by subtracting the day of week
    const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diffToSunday = dayOfWeek;

    // Use setTime instead of setDate to avoid month boundary issues
    startOfWeek.setTime(startOfWeek.getTime() - (diffToSunday * 24 * 60 * 60 * 1000));

    // Reset to start of day to ensure consistency
    startOfWeek.setHours(0, 0, 0, 0);

    return startOfWeek.toISOString().split('T')[0];
  } else {
    return date.toISOString().split('T')[0];
  }
}

function calculateSummaryStats(commits) {
  const languageStats = {};
  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalFiles = 0;

  commits.forEach(commit => {
    commit.files.forEach(file => {
      const language = file.language;

      if (!languageStats[language]) {
        languageStats[language] = {
          additions: 0,
          deletions: 0,
          changes: 0,
          files: 0,
          commits: new Set()
        };
      }

      languageStats[language].additions += file.additions;
      languageStats[language].deletions += file.deletions;
      languageStats[language].changes += file.changes;
      languageStats[language].files++;
      languageStats[language].commits.add(commit.oid);

      totalAdditions += file.additions;
      totalDeletions += file.deletions;
      totalFiles++;
    });
  });

  // Convert Sets to counts
  Object.keys(languageStats).forEach(language => {
    languageStats[language].commits = languageStats[language].commits.size;
  });

  // Sort languages by total changes
  const sortedLanguages = Object.entries(languageStats)
    .sort(([,a], [,b]) => b.changes - a.changes)
    .map(([language, stats]) => ({ language, ...stats }));

  return {
    totalAdditions,
    totalDeletions,
    totalChanges: totalAdditions + totalDeletions,
    totalFiles,
    totalCommits: commits.length,
    languageBreakdown: sortedLanguages,
    topLanguages: sortedLanguages.slice(0, 10)
  };
}