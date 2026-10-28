import test from "node:test";
import assert from "node:assert/strict";
import { parseSetupRequest, parseSetupUpdate, setupRequestsFromResponse, allowedSetupStatuses } from "../src/lib/setup";
import { setupApiRequest, outboundOrigin } from "../src/lib/outbound-transport";
const id="10000000-0000-4000-8000-000000000001";
test("setup inputs only allow assisted combinations and bounded client-visible notes",()=>{
 assert.deepEqual(parseSetupRequest({clientId:id,channel:"email",method:"google_workspace"}),{clientId:id,channel:"email",method:"google_workspace"});
 for(const input of [{clientId:id,channel:"linkedin",method:"microsoft"},{clientId:"wrong",channel:"email",method:"assisted"},{clientId:id,channel:"email",method:"oauth"}])assert.equal(parseSetupRequest(input),null);
 assert.equal(parseSetupUpdate({clientId:id,requestId:id,status:"connected",note:""}),null);
 assert.equal(parseSetupUpdate({clientId:id,requestId:id,status:"resolved",note:"a".repeat(1001)}),null);
 assert.equal(parseSetupUpdate({clientId:id,requestId:id,status:"resolved",note:" Follow up "})?.note,"Follow up");
});
test("response projection rejects mixed workspaces and invalid states, strips extra fields",()=>{
 const row={id,client_id:id,channel:"email",method:"assisted",status:"requested",note:null,created_at:"2026-10-03T12:00:00Z",updated_at:"2026-10-03T12:00:00Z",private_metadata:"hidden"};
 assert.equal("private_metadata" in setupRequestsFromResponse({requests:[row]},id)[0],false);
 assert.throws(()=>setupRequestsFromResponse({requests:[{...row,client_id:"20000000-0000-4000-8000-000000000002"}]},id));
 assert.throws(()=>setupRequestsFromResponse({requests:[{...row,status:"connected"}]},id));
});
test("portal origin accepts fixed HTTPS or development loopback, without URL credentials/paths",()=>{
 assert.equal(outboundOrigin("https://api.outreach.example.com",false),"https://api.outreach.example.com");
 assert.equal(outboundOrigin("http://127.0.0.1:3002",true),"http://127.0.0.1:3002");
 for(const url of [undefined,"http://portal.example.com","https://user:pass@portal.example.com","https://api.outreach.example.com/path","https://api.outreach.example.com?key=value"])assert.throws(()=>outboundOrigin(url,true));
 assert.throws(()=>outboundOrigin("http://localhost:3002",false));
});
test("transport pins endpoint, forwards user bearer only, disables cache and redirects",async()=>{
 let captured: {url:string;options:RequestInit}|undefined;
 const fetcher:typeof fetch=async(input,options)=>{captured={url:String(input),options:options!};return Response.json({requestId:id});};
 await setupApiRequest("https://api.outreach.example.com","user-token",{method:"POST",body:{clientId:id,channel:"email",method:"assisted"}},fetcher);
 assert.equal(captured?.url,"https://api.outreach.example.com/api/outbound/setup");
 assert.equal(captured?.options.redirect,"error");assert.equal(captured?.options.cache,"no-store");
 assert.deepEqual(captured?.options.headers,{Authorization:"Bearer user-token","Content-Type":"application/json"});
});
test("transport never propagates external diagnostic bodies or network errors",async()=>{
 for(const fetcher of [(async()=>new Response("private diagnostic",{status:500})),(async()=>{throw new Error("token in transport error");})] as typeof fetch[]){
 await assert.rejects(setupApiRequest("https://api.outreach.example.com","token",{method:"GET",clientId:id},fetcher),error=>error instanceof Error&&!/private|token/.test(error.message));
 }
});


test("setup status controls follow the authoritative lifecycle and never reopen closed requests", () => {
  assert.deepEqual(allowedSetupStatuses("requested"), ["requested", "in_progress", "needs_action", "resolved"]);
  for (const status of ["in_progress", "needs_action"] as const) {
    assert.deepEqual(allowedSetupStatuses(status), ["in_progress", "needs_action", "resolved"]);
    assert.equal(allowedSetupStatuses(status).includes("requested"), false);
  }
  assert.deepEqual(allowedSetupStatuses("resolved"), ["resolved"]);
});


test("setup notes use the API's Unicode character limit for validation and response history", () => {
  const note = "😀".repeat(700);
  assert.equal(parseSetupUpdate({ clientId: id, requestId: id, status: "needs_action", note })?.note, note);
  const row = { id, client_id: id, channel: "email", method: "assisted", status: "needs_action", note, created_at: "2026-10-03T12:00:00Z", updated_at: "2026-10-03T12:00:00Z" };
  assert.equal(setupRequestsFromResponse({ requests: [row] }, id)[0].note, note);
  const tooLong = "😀".repeat(1001);
  assert.equal(parseSetupUpdate({ clientId: id, requestId: id, status: "needs_action", note: tooLong }), null);
  assert.throws(() => setupRequestsFromResponse({ requests: [{ ...row, note: tooLong }] }, id));
});
