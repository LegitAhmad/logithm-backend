# Logithm API

NestJS + MongoDB API for courses, assignments, typed programming problems, and private submission results. The Angular application lives in `../logithm-frontend`.

## Local development

Requires Node.js 22, npm, MongoDB, and a privately reachable Piston executor with the runtimes below installed.

1. Run `npm ci`.
2. Create a private `.env` from `.env.example`. Set `MONGODB_URI`, `PISTON_URL`, and two different JWT secrets (`openssl rand -hex 32` for each). Do not commit credentials.
3. Start MongoDB and the isolated executor, then run `npm run start:dev`.
4. Start the frontend with `npm ci && npm start` in its directory. It uses `http://localhost:3000` in development; CORS defaults to `http://localhost:4200`.

Supabase avatar storage is optional. Omit all `SUPABASE_*` values to run without it; the UI hides the upload control. If enabled, configure a bucket and appropriate access policies before accepting uploads.

`GET /health/live` checks the API process. `GET /health/ready` checks MongoDB and every required executor runtime/version. `/swagger` documents the API.

## Typed function grading

Students implement a named function and **return a value**. They do not read stdin or serialize their own answer. Language wrappers deserialize arguments, invoke the function, check the native return value, and emit the internal JSON envelope `{ "version": 1, "value": ... }`. Debug prints are separate from the graded return.

Supported adapters and required Piston runtime versions:

| Language | Runtime | Version |
| --- | --- | --- |
| Python | `python` | `3.12.0` |
| JavaScript | `javascript` | `20.11.1` |
| TypeScript | `typescript` | `5.0.3` |
| Go | `go` | `1.16.2` |

Other languages are rejected explicitly; there is no stdout-grading fallback.

Create a question with an `execution` contract:

```json
{
  "functionName": "add",
  "parameters": [
    { "name": "a", "type": { "type": "integer" } },
    { "name": "b", "type": { "type": "integer" } }
  ],
  "returnType": { "type": "integer" }
}
```

Value types are `string`, `number`, `integer`, `boolean`, `null`, `{ "type": "array", "items": <type> }`, and `{ "type": "object", "properties": { "key": <type> } }`. Every declared object property is required; extra properties are rejected. Numbers must be finite and within JSON-safe integer magnitude; integers must be safe integers. Python booleans are not numbers. Types nest up to 12 levels. Contracts support up to 32 unique portable identifiers and 100 tests.

The authoring UI accepts **native JSON values**:

```json
[
  { "input": [5, 10], "expectedOutput": 15, "isHidden": false, "points": 1 },
  { "input": [0, 0], "expectedOutput": 0, "isHidden": true, "points": 2 }
]
```

At the API/storage boundary, `input` and `expectedOutput` are JSON-encoded strings: `{ "input": "[5,10]", "expectedOutput": "15" }`. `input` always represents the positional argument array. An array parameter therefore needs an outer arguments array, e.g. `[[1,2,3], 4]`. False, zero, null, empty strings, arrays and objects are not coerced to strings. Every case is checked on creation, on merged updates, and again before execution.

JSON requests are capped at 6 MiB by nginx, the API, and the Logithm Piston image. Each encoded test input/expected value is limited to 262,144 characters; the complete authoring request must also fit the request budget.

Checkers:

- `{ "type": "exact" }`: structural equality; object key order ignored, array order and value types significant.
- `{ "type": "float", "tolerance": 0.000001 }`: absolute tolerance for numeric returns.
- `{ "type": "custom", "code": "..." }`: a Python `validate(actual, expected, args)` function, executed in a **separate sandbox** from the student program. Inputs are parsed values, not JSON strings. The return must be a strict Python boolean.

```python
def validate(actual, expected, args):
    return sorted(actual) == sorted(expected) and len(actual) == len(args[0])
```

Return-type checking precedes the checker. Visible failures include nested value paths. Compiler failures are completed grading outcomes with compiler feedback, even when the executor omits its run stage; they are not infrastructure errors. Hidden tests expose only index, points, pass/fail and a generic verdict—not input, expected/actual values, logs, compilation diagnostics or resource metadata.

Go functions use `int64` for integers, `float64` for numbers, slices for arrays, and anonymous structs with exported `F0`, `F1`, … fields in contract order and JSON tags for objects. The workspace generates the exact skeleton. Define the function, not `main()`. Go object keys are limited to letters/digits/spaces/underscore/hyphen; use another adapter for other keys.

The pinned Go Piston package compiles inside its `run` stage. Its compilation failures therefore appear as `Runtime Error` with compiler diagnostics, rather than as a separate `Compile Error`. Both are completed zero-score grading outcomes, not transport failures.

Existing questions without `execution` are deliberately not graded as stdout programs. Their owner must open **Edit problem**, define a contract, and convert every test input/expected value to typed JSON before saving.

## Product and access model

- Authenticated users create courses and programming problems. Course creators/admins author assignments; only the assignment owner edits/publishes its draft.
- Course/assignment mutations validate strict request DTOs at runtime. Ordinary edits cannot overwrite ownership, roles, course associations or publication status. Publication uses its dedicated endpoint; only scheduled assignments that have not started can return to draft.
- Students enroll with a course code. Draft and scheduled question content is not exposed to students. Private problems require ownership or access through a published assignment.
- Workspace links preserve `assignmentId`; grading validates membership, question association, publication/start time and deadline on the server.
- `POST /submissions/run` uses visible cases. `POST /submissions` grades all cases and records a score. `/submissions/mine`, `/submissions/question/:questionId`, and `/submissions/:id` return only the caller's results.
- Grading is synchronous. Executor concurrency, queue length, output size, CPU, memory and individual execution time are bounded. The whole request has a 120-second grading budget; an in-flight call may add up to 40 seconds. Deadline exhaustion returns an unavailable error without saving a partial score. Upstream proxies must allow at least 210 seconds. This is not a durable background job queue.
- Refresh credentials are httpOnly cookies; responses contain only access tokens. Refresh sessions are hashed in MongoDB, atomically rotated and bounded to ten sessions per account. Logout revokes the current session. Password changes revoke all sessions and existing access tokens.

## Verification

```sh
npm run build
npm test -- --runInBand
npm run test:execution
```

`test:execution` requires Python 3, Node, and Go locally. It executes fixed trusted examples with the real wrappers: printed-answer rejection, nested values, native type errors, and isolated strict-boolean validators. It is **not** a Piston sandbox/isolation test.

Run API integration tests against explicit disposable services:

```sh
LOGITHM_E2E_MONGODB_URI=mongodb://127.0.0.1:27017/logithm_e2e_test \
LOGITHM_E2E_PISTON_URL=http://private-executor:2000 \
npm run test:e2e -- --runInBand
```

The suite creates users/questions/courses/assignments, validates all four adapters including large Unicode arguments/returns, rejects printed answers and wrong native types, exercises sandbox timeouts and nested custom validators with false/null arguments, checks hidden redaction and submission ownership, blocks ownership/role mass assignment and publication bypasses, and deletes only its fixtures. It never defaults to the application's `.env` service URLs. Use a disposable test database and a real isolated executor for release validation; a trusted-code local transport does not establish sandbox isolation.

## Production application host

The provided compose topology runs MongoDB, the API, and non-root nginx serving the static frontend. MongoDB and the API have no published ports. The API uses a dedicated MongoDB application account, not the database root account. PostgreSQL, Redis and pgAdmin are not required.

Use a permissions-restricted environment file outside the repositories. Required values: `MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD`, distinct `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, exact HTTPS `CORS_ORIGINS`, and private execution-host `PISTON_URL`. Generate independent secrets with `openssl rand -hex 32`; URI-safe hex is recommended for the MongoDB password.

```sh
docker compose --env-file /secure/path/logithm.env config --quiet
docker compose --env-file /secure/path/logithm.env build --pull
docker compose --env-file /secure/path/logithm.env up -d --wait --wait-timeout 180
curl --fail http://127.0.0.1:8080/health/live
curl --fail http://127.0.0.1:8080/api/health/ready
```

Do not publish resolved compose configuration: it contains secrets. The frontend binds to `127.0.0.1:8080` by default. Put a trusted TLS reverse proxy in front; Secure refresh cookies require browser access over HTTPS. `/api/` is proxied to the backend with the prefix stripped. MongoDB account initialization runs only for an empty volume; editing environment passwords does not rotate existing database users. Back up MongoDB and rehearse restore before release.

## Dedicated executor host

Piston needs privileged access and cgroup v2. Run it on a **separate dedicated, disposable execution host**, never beside the API/database. Container limits are not a VM security boundary. Keep application secrets, Docker sockets, unrelated workloads and sensitive mounts off this host.

```sh
docker build --file deployments/piston.Dockerfile --tag logithm-piston:local .
# Set PISTON_IMAGE=logithm-piston:local in /secure/path/executor.env.
docker compose --env-file /secure/path/executor.env -f deployments/piston-compose.yml config --quiet
docker compose --env-file /secure/path/executor.env -f deployments/piston-compose.yml up -d
curl --fail http://127.0.0.1:2000/api/v2/packages
```

Use the image built from `deployments/piston.Dockerfile`, not the unmodified upstream image. It pins its upstream digest and applies guarded corrections for the hard-coded 100 KiB HTTP body limit, prematurely destroyed stdin writes, UTF-8 corruption across output chunks, and returning before output pipes finish draining. An unexpected upstream source change fails the build. Review these integration points when updating the `PISTON_BASE_IMAGE` build argument. The compose configuration sets `PISTON_OUTPUT_MAX_SIZE=2097152`, a four-job global limit and a private cgroup namespace. The API separately caps executor wire responses at 16 MiB to accommodate duplicated streams and JSON escaping.

Set `PISTON_IMAGE` to the reviewed built image tag/digest. Publication defaults to loopback; make any private VPN binding explicit and firewall-restrict it to the API host. Install the four exact runtime versions through Piston's package API, then verify `/api/v2/runtimes`. Package names/available versions come from `/api/v2/packages` (JavaScript's package is commonly `node`). Do not expose executor execution or package-management endpoints to application clients. See [Piston installation](https://github.com/engineer-man/piston#installation) and [Piston API](https://piston.readthedocs.io/en/latest/api-v2/).

The upstream image/runtime catalog contains legacy software, notably Go 1.16. Runtime readiness establishes availability, not security patch status. Review and refresh the execution appliance as part of release maintenance; privileged containers remain unsuitable for isolating hostile programs from sensitive host workloads.

Before release, build and launch the images on a Docker-capable host, exercise real Piston executions and resource limits, verify TLS/cookie/proxy behavior, and apply ingress rate limits appropriate to your deployment. Local wrapper tests do not establish sandbox security.
