# Deploying SafeSpend to AWS App Runner

End-to-end runbook to ship SafeSpend on a public HTTPS URL via Amazon ECR + App Runner.

## What you need

- AWS account with an IAM user that can push to ECR and create App Runner services. Required actions: `ecr:*` (push/pull) plus `apprunner:CreateService`, `apprunner:UpdateService`, `apprunner:StartDeployment`, `iam:PassRole`.
- `aws` CLI v2 + `docker` (with buildx) on the local machine.
- A successful Fuji deploy (`pnpm fuji:deploy` has run, addresses pinned in `shared/src/addresses.ts:43113`).
- A Fuji-funded agent EOA private key, an OpenAI API key, and an Alchemy/Ankr Fuji RPC URL.

## 1. Configure AWS CLI (one-time)

```sh
aws configure                           # paste keys, region=ap-southeast-2 (closest to NZ)
aws sts get-caller-identity             # verify auth
```

## 2. Create ECR repository (one-time)

```sh
aws ecr create-repository \
  --repository-name safespend \
  --region ap-southeast-2 \
  --image-scanning-configuration scanOnPush=true
```

Capture the repository URI:

```sh
export AWS_REGION=ap-southeast-2
export ECR_URI=$(aws ecr describe-repositories \
  --repository-name safespend \
  --region $AWS_REGION \
  --query 'repositories[0].repositoryUri' --output text)
echo $ECR_URI
# expect: <12-digit-acct>.dkr.ecr.ap-southeast-2.amazonaws.com/safespend
```

## 3. Build the production image

From the repo root:

```sh
docker buildx build \
  --platform linux/amd64 \
  -f web/Dockerfile.prod \
  -t safespend-web:v1 \
  --build-arg NEXT_PUBLIC_CHAIN_ID=43113 \
  --build-arg NEXT_PUBLIC_FUJI_RPC_URL="https://avax-fuji.g.alchemy.com/v2/<your-key>" \
  --build-arg NEXT_PUBLIC_MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<your-key>" \
  .
```

> The `--platform linux/amd64` flag matters on Apple Silicon — App Runner runs amd64 only and an arm64 image will fail to start with `exec format error`.

> `NEXT_PUBLIC_*` vars are baked into the bundle at build time, so we pass them as build args. Other (server-side) env vars are injected at runtime by App Runner.

Optional smoke-test the image locally before pushing:

```sh
docker run --rm -p 3000:3000 \
  -e CHAIN_ID=43113 \
  -e RPC_URL="https://avax-fuji.g.alchemy.com/v2/<your-key>" \
  -e MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/<your-key>" \
  -e PRIVATE_KEY="0x..." \
  -e USER_ADDRESS="0x..." \
  -e AUTHORIZED_AGENT_ADDRESS="0x..." \
  -e VAULT_ADDRESS="0x..." \
  -e USDC_ADDRESS="0x..." \
  -e OPENAI_API_KEY="sk-..." \
  -e LLM_PROVIDER=openai \
  -e OPENAI_MODEL=gpt-4o-mini \
  safespend-web:v1
```

Hit `http://localhost:3000` — onboarding should appear, MetaMask connect should work, both lanes should run against Fuji.

## 4. Push to ECR

```sh
# Login (token expires in 12h)
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Tag + push
docker tag safespend-web:v1 $ECR_URI:v1
docker tag safespend-web:v1 $ECR_URI:latest
docker push $ECR_URI:v1
docker push $ECR_URI:latest
```

## 5. Create App Runner service (first deploy, console)

1. AWS Console → **App Runner** → **Create service**.
2. **Source**: Container registry → Amazon ECR → Browse → pick `safespend:v1`.
3. **Deployment trigger**: **Manual** (auto-deployments can fire mid-presentation).
4. **ECR access role**: Create new service role — let App Runner auto-create `AppRunnerECRAccessRole`.
5. **Service name**: `safespend`.
6. **Virtual CPU**: 1 vCPU. **Memory**: 2 GB.
7. **Port**: `3000`.
8. **Environment variables** — paste these in the "Environment variables" section:

   | Key | Value |
   |---|---|
   | `CHAIN_ID` | `43113` |
   | `NODE_ENV` | `production` |
   | `RPC_URL` | `https://avax-fuji.g.alchemy.com/v2/<your-key>` |
   | `MAINNET_RPC_URL` | `https://eth-mainnet.g.alchemy.com/v2/<your-key>` |
   | `LLM_PROVIDER` | `openai` |
   | `OPENAI_API_KEY` | `sk-...` (set hard $5 cap at platform.openai.com) |
   | `OPENAI_MODEL` | `gpt-4o-mini` |
   | `PRIVATE_KEY` | the agent EOA private key |
   | `USER_ADDRESS` | the demo user EOA |
   | `AUTHORIZED_AGENT_ADDRESS` | derived from PRIVATE_KEY (same as USER_ADDRESS in the deploy script if user is the agent) |
   | `VAULT_ADDRESS` | from `shared/src/addresses.ts:43113.vault` |
   | `USDC_ADDRESS` | from `shared/src/addresses.ts:43113.usdc` |

9. **Auto scaling**: **Min size 1, Max size 1** (single-tenant demo; avoids cold starts during the live demo).
10. **Health check**: HTTP, path `/api/health`, interval 10s, timeout 5s, unhealthy threshold 5, healthy threshold 1.
11. Create + Deploy. **First provision takes ~10-15 minutes** while AWS allocates compute.

When done, App Runner returns a URL like `https://abc123def4.ap-southeast-2.awsapprunner.com`. That's the public demo URL.

## 6. Subsequent deploys

After any code change, rebuild and push, then trigger a redeploy:

```sh
# Bump tag
docker buildx build --platform linux/amd64 -f web/Dockerfile.prod -t safespend-web:v2 \
  --build-arg NEXT_PUBLIC_CHAIN_ID=43113 \
  --build-arg NEXT_PUBLIC_FUJI_RPC_URL="..." \
  --build-arg NEXT_PUBLIC_MAINNET_RPC_URL="..." .
docker tag safespend-web:v2 $ECR_URI:v2
docker tag safespend-web:v2 $ECR_URI:latest
docker push $ECR_URI:v2
docker push $ECR_URI:latest

# Find the service ARN and trigger a deployment
SERVICE_ARN=$(aws apprunner list-services --region $AWS_REGION \
  --query "ServiceSummaryList[?ServiceName=='safespend'].ServiceArn" --output text)
aws apprunner start-deployment --service-arn $SERVICE_ARN --region $AWS_REGION
```

Redeploy takes ~3-5 minutes, zero downtime.

## Rollback

```sh
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --source-configuration "ImageRepository={ImageIdentifier=$ECR_URI:v1,ImageRepositoryType=ECR}" \
  --region $AWS_REGION
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `denied: Your authorization token has expired` on `docker push` | ECR login token is 12h | Re-run the `aws ecr get-login-password \| docker login` command |
| App Runner status `OPERATION_IN_PROGRESS` for >20min | First-time service-linked role provisioning | Wait. Open AWS support if >30min. |
| `exec format error` in App Runner CloudWatch logs | Image was built for arm64 (Apple Silicon) | Rebuild with `--platform linux/amd64` |
| Health check fails immediately, service stuck in `CREATING` | Container crashed during boot | Check CloudWatch logs in the App Runner console for the stacktrace; usually a missing required env var |
| Env var change doesn't take effect | App Runner needs explicit deploy after env change | UI: "Deploy" button. CLI: `start-deployment`. |
| 502 Bad Gateway hitting the URL | Container is up but the request crashed | CloudWatch logs. Common: a missing env var read by `runSafeSpendAgent` |
| `/api/run` 500s with `chainId=43113 has unset addresses` | Fuji deploy didn't run, or `shared/src/addresses.ts` wasn't committed before building the image | Run `pnpm fuji:deploy`, commit, rebuild the image |

## Cost

App Runner: ~$0.064/hour for 1 vCPU / 2GB. With min size 1, that's ~$1.50/day. ECR storage and outbound data are negligible for a demo.
