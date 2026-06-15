import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filePacket } from "./demo-client";

type FetchImpl = typeof fetch;

function fakeFetch(routes: {
  token: object;
  account: number;
  attachmentOk?: boolean;
}): FetchImpl {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/oauth2/token")) {
      return new Response(JSON.stringify(routes.token), { status: 200 });
    }
    if (u.includes("/oauth2/userinfo")) {
      return new Response(JSON.stringify({ data: { account: { id: routes.account } } }), {
        status: 200,
      });
    }
    if (u.includes("/attachment")) {
      return new Response(JSON.stringify({ data: { id: 123 } }), {
        status: routes.attachmentOk === false ? 500 : 200,
      });
    }
    return new Response("not found", { status: 404 });
  }) as FetchImpl;
}

const creds = { clientId: "demo-id", clientSecret: "demo-secret", jobId: "999" };

describe("filePacket", () => {
  it("REFUSES to write when the account is not the demo (9000)", async () => {
    const f = fakeFetch({ token: { access_token: "t" }, account: 9316 });
    await assert.rejects(
      () => filePacket(new Uint8Array([1, 2, 3]), "packet.pdf", creds, f),
      /demo account/i,
    );
  });

  it("uploads the packet when the account is the demo (9000)", async () => {
    const f = fakeFetch({ token: { access_token: "t" }, account: 9000, attachmentOk: true });
    const res = await filePacket(new Uint8Array([1, 2, 3]), "packet.pdf", creds, f);
    assert.equal(res.attachmentId, 123);
  });
});
