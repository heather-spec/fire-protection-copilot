// Demo-account ServiceTrade client. Structurally cannot touch the live account:
// it asserts the authenticated account id is 9000 before any write, and the
// only write path is uploading a packet to the configured demo job.

const BASE = "https://api.servicetrade.com/api"; // matches the proven Python client
const DEMO_ACCOUNT_ID = 9000;

export interface DemoCreds {
  clientId: string;
  clientSecret: string;
  jobId: string; // SERVICETRADE_TEST_JOB_ID
}

export interface FilePacketResult {
  attachmentId: number;
}

export function demoCredsFromEnv(): DemoCreds {
  const clientId = process.env.SERVICETRADE_CLIENT_ID;
  const clientSecret = process.env.SERVICETRADE_CLIENT_SECRET;
  const jobId = process.env.SERVICETRADE_TEST_JOB_ID;
  if (!clientId || !clientSecret || !jobId) {
    throw new Error("ServiceTrade demo creds missing from environment");
  }
  return { clientId, clientSecret, jobId };
}

async function mintToken(creds: DemoCreds, fetchImpl: typeof fetch): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const res = await fetchImpl(`${BASE}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`ServiceTrade token ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("ServiceTrade token response missing access_token");
  return json.access_token;
}

async function assertDemoAccount(token: string, fetchImpl: typeof fetch): Promise<void> {
  const res = await fetchImpl(`${BASE}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ServiceTrade userinfo ${res.status}`);
  const json = (await res.json()) as { data?: { account?: { id?: number } } };
  const accountId = json.data?.account?.id;
  if (accountId !== DEMO_ACCOUNT_ID) {
    throw new Error(
      `Refusing to write: authenticated account ${accountId} is not the demo account (${DEMO_ACCOUNT_ID}).`,
    );
  }
}

/**
 * Upload a packet PDF to the configured demo job as Job Paperwork.
 * `fetchImpl` is injectable for tests; defaults to global fetch.
 */
export async function filePacket(
  pdfBytes: Uint8Array,
  filename: string,
  creds: DemoCreds,
  fetchImpl: typeof fetch = fetch,
): Promise<FilePacketResult> {
  const token = await mintToken(creds, fetchImpl);
  await assertDemoAccount(token, fetchImpl); // hard guard before any write

  const form = new FormData();
  // ServiceTrade requires the file field to be named exactly "uploadedFile".
  form.append("uploadedFile", new Blob([pdfBytes], { type: "application/pdf" }), filename);
  form.append("entityId", creds.jobId);
  form.append("entityType", "3"); // 3 = Job
  form.append("purposeId", "1"); // 1 = Job Paperwork

  const res = await fetchImpl(`${BASE}/attachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }, // do NOT set content-type; let fetch add the boundary
    body: form,
  });
  if (!res.ok) throw new Error(`ServiceTrade attachment ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: { id?: number } };
  if (typeof json.data?.id !== "number") {
    throw new Error("ServiceTrade attachment response missing id");
  }
  return { attachmentId: json.data.id };
}
