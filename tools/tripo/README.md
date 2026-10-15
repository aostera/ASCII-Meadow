# The Ashen Vow — Tripo API budget guard

Status: ZERO PAID TASKS LAUNCHED. No production changes.

## What is already ready

- The user-approved reference is cropped into FRONT / LEFT / BACK / RIGHT locally with Pillow. Opposite SIDE is mirrored at no API cost. Check the free GitHub Actions artifact from the preflight workflow.
- A FREE balance GET is run by .github/workflows/tripo-budget-preflight.yml.
- A dormant paid workflow .github/workflows/tripo-one-shot.yml cannot start from code changes. Its sole trigger is a new push of the presently NONEXISTENT approval request file tools/tripo/approved-request.json.
- No auto-generated textures, PBR, premium detailed geometry, separate sword generation, rig, animations, export conversion, retries or recurring jobs.
- Feature branch originates from experiment/threejs-ascii-prototype, never production main.

## Real API price, according to official billing

H3.1 multiview_to_model (v3.1-20260211), texture=false, pbr=false, geometry_quality=standard: 20 credits (about $0.20 at $1 per 100 credits). A single-image generation has the SAME base price. Actual task charge is available in consumed_credit.

Additional costs must always require separate future permission: rig 25 credits, retarget 10 credits per animation, texture 10+ credits, detailed geometry additional 20.

## Security and approval

The first preflight job showed an EMPTY TRIPO_API_KEY in the GitHub Action environment. Confirm that the repository aostera/ASCII-Meadow has a **Repository secret** named exactly TRIPO_API_KEY. Environment secrets are not automatically exposed to jobs without the appropriate environment: configuration. Never reveal the key in chat, an issue, git, or logs.

Adding a secret does not authorize paid use.

ONLY AFTER the user explicitly approves one 20-credit generation:

1. Check wallet balance by safe read-only GET.
2. Add a single file at tools/tripo/approved-request.json to the feat/tripo-ashen-budget-gated feature branch, with these exact contents:

    {"authorization":"TRIPO_APPROVE_ONCE_20_CREDITS","max_total_credits":20,"count":1,"model":"v3.1-20260211"}

3. Commit that file with exact commit message: TRIPO_APPROVE_ONCE_20_CREDITS.
4. This commit triggers one paid action, guarded by GITHUB_RUN_ATTEMPT=1. No subsequent paid retries will be scheduled, even on failure.
5. Evaluate downloaded GLB in a grey 3D viewer BEFORE integrating into native.html.

Official API sources:
- https://platform.tripo3d.ai/docs/billing
- https://platform.tripo3d.ai/docs/wallet
- https://platform.tripo3d.ai/docs/upload
- https://platform.tripo3d.ai/docs/schema
