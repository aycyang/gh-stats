export async function handler(event) {
  console.log("=== Incoming Request ===");
  console.log("Query Parameters:", event.queryStringParameters);

  const code = event.queryStringParameters.code;

  if (!code) {
    console.error("❌ Missing code parameter in request");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing code parameter" }),
    };
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  console.log("Client ID:", clientId ? "✅ Set" : "❌ Missing");
  console.log("Client Secret:", clientSecret ? "✅ Set" : "❌ Missing");

  try {
    console.log("➡️ Exchanging code for access token...");
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("❌ Error exchanging code");
      return { statusCode: 400, body: JSON.stringify(tokenData) };
    }

    const accessToken = tokenData.access_token;

    console.log("➡️ Fetching user profile from GitHub...");
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "Netlify-GitHub-OAuth-App",
      },
    });

    const userData = await userResponse.json();
    console.log("GitHub User Data:", userData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...userData,
        access_token: accessToken
      }),
    };
  } catch (err) {
    console.error("💥 Unexpected error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
