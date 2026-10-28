# Assisted setup access and request lifecycle

## Symptom

The original results resolver inferred workspace access from legacy profile roles and a single client ID. That model cannot express independent Outbound memberships or operators assigned to several companies. An initial setup UI also offered all statuses after a request had progressed and counted note length differently from the API.

## Root cause

Identity and product authorization were coupled, and the first UI validation did not preserve the database's transition and Unicode semantics.

## Approach that worked

Resolve active product access exclusively from the guarded workspace projection. Validate selected companies against that projection on each server action; keep the agency queue limited to explicit agency owners and assigned operators. Forward the verified user bearer token from the server to one configured API origin with redirects and caching disabled. Keep private database tables outside generated frontend types.

The status picker and server action now share the allowed transition helper. Requests cannot return to Requested after progressing; closed requests stay closed. Remount update forms when the authoritative request timestamp or status changes. Validate note length in Unicode code points to match the API and accept valid saved notes containing supplementary characters.

The owner subsequently chose Covora-managed setup as the default. Default requests to the existing assisted method, and put existing inbox-type details behind optional disclosure. Use neutral “Email setup” wording for assisted history: the method does not establish whether new inboxes or domains were requested. Show the latest client-visible note in the list and preserve a separate closed-request state. Focus the visible introduction when opening the request dialog so a select inside closed details never becomes the initial focus target.

## Rule for next time

Treat shared sign-in and product permission as separate boundaries. Match backend lifecycle and string validation in client validation, and test tenant denial as well as success. Assisted setup must never imply that an account is connected or ready to send.

Request deduplication is per company, channel and method; it is not a mailbox inventory. Repeating the same request can return an existing request, so success copy must cover both creation and reuse. A request label must not imply purchased infrastructure or verified ownership.

## Evidence

The frontend suite covers unauthorized company selection, legacy-role rejection, role capabilities, response projection, request validation, lifecycle transitions, Unicode notes and safe bearer transport. Lint, typecheck, the source boundary scan and production build pass. Browser and authenticated integration verification are coordinated separately by the parent task.
