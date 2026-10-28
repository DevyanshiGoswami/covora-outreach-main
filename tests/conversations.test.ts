import test from "node:test";
import assert from "node:assert/strict";
import { canReplyInWorkspace, CONVERSATION_STAGES, conversationStage, conversationsFromResponse, detailFromResponse, filterConversations, replyFromResponse, validReplyInput, type ConversationDetail, type ReplyInput } from "../src/lib/conversations";
import { ConversationServiceError, conversationsApiRequest } from "../src/lib/conversations-transport";
import { loadInboxData } from "../src/lib/inbox-loading";
import { EMPTY_DATA } from "../src/lib/model";
import type { OutreachRole, Workspace } from "../src/lib/access";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReplyActivity } from "../src/components/reply-composer";
const clientId="00000000-0000-4000-8000-000000000001", otherId="00000000-0000-4000-8000-000000000002", id="10000000-0000-4000-8000-000000000001", messageId="20000000-0000-4000-8000-000000000001", commandId="30000000-0000-4000-8000-000000000001";
const now="2026-10-03T12:00:00Z";
const detail: ConversationDetail = { id,clientId,channel:"email",campaignId:null,campaignName:"Introductions",subject:"Hello",contactName:"Taylor Reed",contactAddress:"taylor@example.test",senderLabel:"team@example.test",owner:{kind:"covora",userId:null,name:"Covora"},ownedByMe:false,version:1,latestMessageId:messageId,latestAt:now,preview:"Interested in learning more",unread:true,status:"needs_reply",interest:"Interested",canReply:true,canTakeover:true,replyUnavailableReason:null,messages:[{id:messageId,direction:"received",bodyText:"<script>plain text only</script>",sentAt:now,senderLabel:"Taylor"}],commands:[],messagesTruncated:false };
const input: ReplyInput = { clientId,commandId,expectedVersion:1,latestMessageId:messageId,bodyText:"Hello Taylor",takeover:true };

test("reply receipts preserve submitted text and actor without manufacturing delivery or synced history",()=>{
 const bodyText='<img src="https://not-loaded.example.test/pixel"> Thanks for your reply.';
 for(const status of ["sent","unknown","failed"] as const){
  const conversation={...detail,commands:[{id:commandId,conversationId:id,bodyText,status,createdAt:now,updatedAt:now,actorName:"Alex Carter"}]};
  const html=renderToStaticMarkup(createElement(ReplyActivity,{conversation,demo:false}));
  assert.match(html,/Reply activity/);
  assert.match(html,/Alex Carter/);
  assert.match(html,/dateTime="2026-10-03T12:00:00Z"/i);
  assert.match(html,/&lt;img src=/);
  assert.equal(html.includes('<img '),false);
  assert.match(html,/Acceptance does not confirm delivery/);
  assert.equal(html.includes('message-entry'),false);
  assert.match(html,status==="sent"?/Reply accepted for sending/:status==="unknown"?/Sending outcome unknown/:/Reply was not sent/);
 }
 assert.equal(renderToStaticMarkup(createElement(ReplyActivity,{conversation:detail,demo:false})),"");
});

test("reply permissions require active matching product membership and include members but not viewers",()=>{
 const workspace: Workspace={clientId,clientName:"Client",enabled:true,role:"client_admin",clients:[]};
 for(const role of ["client_admin","client_member","operator","agency_owner"] as OutreachRole[]) assert.equal(canReplyInWorkspace({...workspace,role},clientId),true);
 for(const role of ["client_viewer",null] as const) assert.equal(canReplyInWorkspace({...workspace,role},clientId),false);
 assert.equal(canReplyInWorkspace(workspace,otherId),false);
 assert.equal(canReplyInWorkspace({...workspace,enabled:false},clientId),false);
});
test("DTO boundaries enforce client, channel, target and shape while stripping private extra fields",()=>{
 const parsed=conversationsFromResponse({conversations:[{...detail,privateReference:"hidden"}],nextCursor:null},clientId,"email");
 assert.equal("privateReference" in parsed.conversations[0],false);
 assert.equal("messages" in parsed.conversations[0],false);
 assert.throws(()=>conversationsFromResponse({conversations:[detail],nextCursor:null},otherId,"email"));
 assert.throws(()=>conversationsFromResponse({conversations:[detail],nextCursor:null},clientId,"linkedin"));
 assert.throws(()=>conversationsFromResponse({conversations:[detail,detail],nextCursor:null},clientId,"all"));
 assert.throws(()=>detailFromResponse({conversation:{...detail,version:NaN}},clientId,id));
 assert.throws(()=>detailFromResponse({conversation:detail},clientId,otherId));
 assert.throws(()=>detailFromResponse({conversation:{...detail,owner:{kind:"user",userId:null,name:"Unknown"}}},clientId,id));
 assert.throws(()=>detailFromResponse({conversation:{...detail,messages:[{...detail.messages[0],sentAt:"not a date"}]}},clientId,id));
 assert.equal(detailFromResponse({conversation:detail},clientId,id).messages[0].bodyText,"<script>plain text only</script>");
 assert.equal(conversationsFromResponse({conversations:[{...detail,interest:undefined}],nextCursor:null},clientId,"all").conversations[0].interest,null);
});
test("reply validation trims only outer whitespace and enforces both Unicode and serialized UTF8 limits",()=>{
 assert.equal(validReplyInput({...input,bodyText:"  Hi\n  Taylor  "})?.bodyText,"Hi\n  Taylor");
 assert.equal(validReplyInput({...input,bodyText:"a".repeat(4000)})?.bodyText.length,4000);
 assert.equal(validReplyInput({...input,bodyText:"a".repeat(4001)}),null);
 assert.equal(validReplyInput({...input,bodyText:"😀".repeat(2000)}),null);
 assert.ok(validReplyInput({...input,bodyText:"😀".repeat(1800)}));
 assert.equal(validReplyInput({...input,expectedVersion:1.5}),null);
 assert.equal(validReplyInput({...input,takeover:"true"}),null);
 assert.equal(validReplyInput({...input,latestMessageId:"foreign-token"}),null);
 assert.equal(validReplyInput({...input,latestMessageId:null}),null);
});
test("reply results bind durable commands to the exact submitted id, body and conversation",()=>{
 const command={id:commandId,conversationId:id,bodyText:input.bodyText,status:"unknown",createdAt:now,updatedAt:now,actorName:"You"};
 assert.equal(replyFromResponse({command,conversation:detail},clientId,id,input).command.status,"unknown");
 assert.throws(()=>replyFromResponse({command:{...command,bodyText:"Changed"},conversation:detail},clientId,id,input));
 assert.throws(()=>replyFromResponse({command:{...command,conversationId:otherId},conversation:detail},clientId,id,input));
 assert.throws(()=>replyFromResponse({command:{...command,id:otherId},conversation:detail},clientId,id,input));
});
test("campaign, prospect outcome, queue, unread and contact filters remain composable",()=>{
 const other={...detail,id:otherId,channel:"linkedin" as const,interest:null,status:"waiting" as const,unread:false,campaignName:"Other campaign"};
 const filters={search:"TAYLOR@",campaign:"Introductions",interest:"Interested",status:"needs_reply",unread:true};
 assert.deepEqual(filterConversations([detail,other],filters).map(item=>item.id),[id]);
 assert.deepEqual(filterConversations([detail,other],{search:"",campaign:"",interest:"unclassified",status:"",unread:false}).map(item=>item.id),[otherId]);
 assert.equal(filterConversations([detail,other],{...filters,status:"waiting"}).length,0);
});
test("transport fixes endpoints, scopes opaque cursors, omits cookies and redirects, and does not retry",async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const fetcher:typeof fetch=async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({ok:true});};
 await conversationsApiRequest("https://api.example.test","test-session",{kind:"list",clientId,channel:"linkedin",cursor:"opaque+/=value"},fetcher);
 await conversationsApiRequest("https://api.example.test","test-session",{kind:"detail",clientId,conversationId:id},fetcher);
 await conversationsApiRequest("https://api.example.test","test-session",{kind:"read",conversationId:id,body:{clientId}},fetcher);
 await conversationsApiRequest("https://api.example.test","test-session",{kind:"owner",conversationId:id,body:{clientId,expectedVersion:1,owner:"me"}},fetcher);
 await conversationsApiRequest("https://api.example.test","test-session",{kind:"reply",conversationId:id,body:input},fetcher);
 assert.equal(new URL(calls[0].url).searchParams.get("cursor"),"opaque+/=value");
 assert.equal(new URL(calls[0].url).searchParams.get("channel"),"linkedin");
 assert.deepEqual(calls.map(call=>new URL(call.url).pathname),["/api/outbound/conversations",`/api/outbound/conversations/${id}`,`/api/outbound/conversations/${id}/read`,`/api/outbound/conversations/${id}/owner`,`/api/outbound/conversations/${id}/reply`]);
 assert.deepEqual(calls.map(call=>call.init.method),["GET","GET","POST","POST","POST"]);
 for(const call of calls){assert.equal(call.init.cache,"no-store");assert.equal(call.init.credentials,"omit");assert.equal(call.init.redirect,"error");assert.equal((call.init.headers as Record<string,string>).Authorization,"Bearer test-session");}
 assert.deepEqual(JSON.parse(calls[4].init.body as string),input);
 let attempts=0;
 await assert.rejects(()=>conversationsApiRequest("https://api.example.test","test-session",{kind:"reply",conversationId:id,body:input},async()=>{attempts++;throw new Error("private upstream diagnostics");}),error=>error instanceof ConversationServiceError&&error.uncertain&&!error.message.includes("private"));
 assert.equal(attempts,1);
});
test("ambiguous send responses stay unknown while explicit conflicts preserve a safe unsent error",async()=>{
 for(const response of [new Response("private",{status:503}),new Response("bad json",{status:200})]){
  await assert.rejects(()=>conversationsApiRequest("https://api.example.test","test-session",{kind:"reply",conversationId:id,body:input},async()=>response),error=>error instanceof ConversationServiceError&&error.uncertain);
 }
 await assert.rejects(()=>conversationsApiRequest("https://api.example.test","test-session",{kind:"reply",conversationId:id,body:input},async()=>new Response("private",{status:409})),error=>error instanceof ConversationServiceError&&!error.uncertain&&!error.message.includes("private"));
});
test("unified and mirrored history failures are independent; unavailable data never masquerades as an empty inbox",async()=>{
 const page={conversations:[detail],nextCursor:null};
 assert.deepEqual((await loadInboxData(async()=>{throw new Error("mirror");},async()=>page)).conversations,page);
 const fallback=await loadInboxData(async()=>({...EMPTY_DATA,messages:[]}),async()=>{throw new Error("private");});
 assert.equal(fallback.conversations,null);assert.ok(fallback.conversationError);assert.ok(!fallback.conversationError.includes("private"));
 await assert.rejects(()=>loadInboxData(async()=>{throw new Error("mirror");},async()=>{throw new Error("api");}),/Inbox history could not be loaded/);
});

test("every conversation lands in exactly one inbox stage",()=>{
 const latestAt="2026-10-20T10:00:00Z";
 assert.equal(conversationStage({status:"needs_reply",interest:"Interested",latestAt}),"needs_action");
 assert.equal(conversationStage({status:"needs_reply",interest:null,latestAt},"2026-10-30T10:00:00Z"),"needs_action");
 assert.equal(conversationStage({status:"waiting",interest:"Interested",latestAt},"2026-10-22T10:00:00Z"),"waiting");
 assert.equal(conversationStage({status:"waiting",interest:"Interested",latestAt},"2026-10-23T10:00:00Z"),"follow_up");
 assert.equal(conversationStage({status:"waiting",interest:null,latestAt}),"waiting");
 assert.equal(conversationStage({status:"needs_reply",interest:"Meeting booked",latestAt}),"meeting");
 assert.equal(conversationStage({status:"waiting",interest:"Not interested",latestAt},"2026-10-30T10:00:00Z"),"refused");
 assert.equal(conversationStage({status:"done",interest:"Meeting booked",latestAt}),"done");
 assert.deepEqual(CONVERSATION_STAGES.map(item=>item.value),["needs_action","waiting","follow_up","meeting","refused","done"]);
});
