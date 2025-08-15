// this code is fundamentally flawed. CORS blocks the browser from making
// requests to the access_token endpoint. it must be done on the server-side.
// doing the whole oauth flow client-side is also iffy.
function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function makeQueryParamString(params) {
  return new URLSearchParams(params).toString();
}

function makeGHAuthURL() {
  const part1 = "https://github.com/login/oauth/authorize";
  const part2 = makeQueryParamString({client_id: "<redacted>"});
  return [part1, part2].join("?");
}

function makeGHTokenURL(code) {
  const part1 = "https://github.com/login/oauth/access_token";
  const part2 = makeQueryParamString({
    client_id: "<redacted>",
    // TODO use PKCE to avoid hardcoding this
    client_secret: "<redacted>",
    code: code,
  });
  return [part1, part2].join("?");
}

queryParams = getQueryParams();
if (queryParams.has("code")) {
  // trade code for token
  const code = queryParams.get("code");
  const url = makeGHTokenURL(code);
  fetch(url, {
    method: "post",
  }).then(response => {
    console.log(response);
  })
} else {
  // render login button
  let link = document.createElement("a");
  link.href = makeGHAuthURL();
  link.innerHTML = "login to github";
  document.body.appendChild(link);
}
