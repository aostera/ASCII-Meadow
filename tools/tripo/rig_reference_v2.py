#!/usr/bin/env python3
"""Tripo-only stage 1: ONE paid 5-credit reference re-pose, then STOP for art review.
No Higgsfield, no subscriptions, no auto-retries, no model/rig/animation tasks.
The original user concept's face, armor and tattered cape remain the source.
"""
import json
import os
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse
from tripo_budget import key, balance, prepare, upload_image, request_json

AUTH="TRIPO_APPROVE_RIG_REFERENCE_V2_5_CREDITS"
OUT=Path("artifacts/tripo-ashen-rig-v2")
PROMPT=(
 "Strict identity-preserving pose edit of image reference: the SAME slender gothic "
 "dark fantasy knight, worn black layered engraved plate armour, dark burgundy hood "
 "with thorn crown, narrow cracked ivory mask with black eye slits, dirty ivory "
 "tabard with faded red cross and shredded burgundy cape behind body. "
 "Remove the sword, scabbard, hilt and ALL weapons completely. "
 "Make a neutral animation-ready symmetrical A-pose, arms out 30 degrees from torso, "
 "gloved hands clearly free from cape and hips, legs shoulder width and separated, "
 "feet planted forward, cloak behind shoulders but NOT touching arms or legs. "
 "Orthographic straight FRONT full-body view; same identity, proportions, outfit. "
 "Plain uniform charcoal backdrop. No labels, no floor debris, no additional props."
)

def guard():
 if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_RUN_ATTEMPT")!="1":
  raise RuntimeError("Tripo image task must be one-shot GitHub Actions run #1.")
 if os.environ.get("GITHUB_REF")!="refs/heads/feat/tripo-ashen-rig-ready":
  raise RuntimeError("Wrong protected Tripo working branch.")
 ev=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
 if ev.get("head_commit",{}).get("message")!=AUTH:
  raise RuntimeError("No explicit one-shot approval commit.")
 approval=json.loads(Path("tools/tripo/approvals/pose-v2.json").read_text())
 if approval != {"authorization":AUTH,"max_credits":5,"count":1,"model":"flux.1_kontext_pro"}:
  raise RuntimeError("Wrong authorization values; STOP.")
 
def main():
 guard()
 token=key()
 b=balance(token)
 if b<5:raise RuntimeError("No available 5 credits; no paid task.")
 OUT.mkdir(parents=True,exist_ok=True)
 src=prepare()[0]
 upload=upload_image(src,token)
 data={
  "type":"generate_image",
  "model_version":"flux.1_kontext_pro",
  "file":upload,
  "prompt":PROMPT,
  "t_pose":True
 }
 print("Submitting ONE Tripo generate_image identity-preserving rig-reference, 5 credits.",flush=True)
 # EXACTLY ONE paid POST. Never retry even on network timeouts.
 task=request_json("/task",data=data,token=token)
 tid=task["task_id"]
 print("TRIPO_POSE_IMAGE_TASK_ID="+tid,flush=True)
 for _ in range(90):
  import time
  st=request_json("/task/"+tid,token=token)
  state=st.get("status")
  print("Tripo pose task="+str(state)+" credits="+str(st.get("consumed_credit","?")),flush=True)
  if state=="success":
   output=st.get("output") or {}
   url=(output.get("rendered_image") or output.get("image") or 
        output.get("generated_image"))
   if not isinstance(url,str) or not url.startswith("https://"):
    (OUT/"pose-result-fields.json").write_text(json.dumps({
      "task_id":tid, "output_keys":list(output),
      "consumed_credit":st.get("consumed_credit")},indent=2))
    raise RuntimeError("Image generated, but image URL key not recognized; do not rerun paid task.")
   with urlopen(url,timeout=90) as res:
    raw=res.read(15000000)
   ext=".png" if raw.startswith(b"\x89PNG") else ".jpg" if raw.startswith(b"\xff\xd8") else None
   if not ext:raise RuntimeError("Tripo returned non-image bytes; no retry.")
   (OUT/("ASHEN_VOW_A_POSE_FRONT"+ext)).write_bytes(raw)
   (OUT/"pose-result.json").write_text(json.dumps({
     "task_id":tid,"status":state,"consumed_credit":st.get("consumed_credit"),
     "model":"flux.1_kontext_pro","rig":False,"animations":0
   },indent=2))
   print("Saved ONE Tripo pose reference",len(raw),"bytes; STOP here for visual review.",flush=True)
   return
  if state in ["failed","cancelled","expired","banned"]:
   raise RuntimeError("Tripo pose failed: "+state+". No paid retries.")
  time.sleep(10)
 raise RuntimeError("Polling timed out; refer to task ID above and DO NOT repeat POST.")

if __name__=="__main__":
 main()
