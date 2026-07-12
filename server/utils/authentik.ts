const { AUTHENTIK_ENDPOINT, AUTHENTIK_USER, AUTHENTIK_PASSWORD } = process.env;

if (!AUTHENTIK_ENDPOINT) throw new Error("Missing AUTHENTIK_ENDPOINT");
if (!AUTHENTIK_USER) throw new Error("Missing AUTHENTIK_USER");
if (!AUTHENTIK_PASSWORD) throw new Error("Missing AUTHENTIK_PASSWORD");

export async function getAccessToken(clientId: string) {
  const tokenUrl = new URL("/application/o/token/", AUTHENTIK_ENDPOINT!);
  const clientSecret = btoa(`${AUTHENTIK_USER!}:${AUTHENTIK_PASSWORD!}`);
  const urlencoded = new URLSearchParams();
  urlencoded.append("client_id", clientId);
  urlencoded.append("grant_type", "client_credentials");
  urlencoded.append("scope", "profile");
  urlencoded.append("client_secret", clientSecret);
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: myHeaders,
    body: urlencoded,
    redirect: "follow",
  });
  if (!response.ok) {
    console.error(response);
    throw new Error("Authentik Login Failed");
  }
  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}
