#!/usr/bin/env python3
"""Tripo-only: ONE 10-credit A-pose 4-view generation. STOP for review after task."""
import json,os,time
from pathlib import Path
from urllib.request import urlopen
from PIL import Image
from tripo_budget import key,balance,upload_image,request_json
AUTH="TRIPO_APPROVE_MULTIVIEW_V2_10_CREDITS"
OUT=Path("artifacts/tripo-ashen-multiview-v2")
SOURCE=Path("/tmp/tripo-ashen-rig-v2/ASHEN_VOW_A_POSE_FRONT.png")
def main():
 if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_RUN_ATTEMPT")!="1" or os.environ.get("GITHUB_REF")!="refs/heads/feat/tripo-ashen-rig-ready":
  raise RuntimeError("Only original GitHub Actions run on the private experiment feature branch")
 ev=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
 a=json.loads(Path("tools/tripo/approvals/multiview-v2.json").read_text())
 if ev.get("head_commit",{}).get("message")!=AUTH or a!={"authorization":AUTH,"max_credits":10,"count":1}:
  raise RuntimeError("Approval not recognized. ZERO paid calls")
 if not SOURCE.exists():raise RuntimeError("Missing generated A-pose: no paid requests made")
 token=key(); b=balance(token)
 if b<10:raise RuntimeError("Insufficient 10 credits")
 OUT.mkdir(parents=True,exist_ok=True)
 # Tripo upload helper handles JPEG. Keep original downloaded PNG in output for comparison.
 Image.open(SOURCE).convert("RGB").save(OUT/"A_POSE_FRONT_SOURCE.jpg",quality=96)
 img=upload_image(OUT/"A_POSE_FRONT_SOURCE.jpg",token)
 print("One Tripo multiview-image task, 10 credits, new pose/no weapon; no retries",flush=True)
 task=request_json("/task",data={"type":"generate_multiview_image","file":img},token=token)
 tid=task["task_id"];print("TRIPO_MULTIVIEW_V2_TASK_ID="+tid,flush=True)
 for _ in range(100):
  st=request_json("/task/"+tid,token=token)
  state=st.get("status");print("Tripo multi-view "+str(state)+" cost "+str(st.get("consumed_credit","?")),flush=True)
  if state=="success":
   output=st.get("output") or {}
   views=output.get("generate_multiview_image") or {}
   if not views:
    (OUT/"unrecognized-result.json").write_text(json.dumps({"id":tid,"output_keys":list(output)}))
    raise RuntimeError("Tripo result lacks 4 views. NO paid retry")
   result={"task_id":tid,"consumed_credit":st.get("consumed_credit"),"type":"generate_multiview_image","views":[]}
   for name in ("front","left","back","right"):
    url=views.get(name+"_view_url")
    if not isinstance(url,str) or not url.startswith("https://"):
     raise RuntimeError("Missing "+name+" view; no new paid task")
    with urlopen(url,timeout=80) as resp:data=resp.read(13000000)
    ext=".png" if data.startswith(b"\x89PNG") else ".jpg" if data.startswith(b"\xff\xd8") else None
    if not ext:raise RuntimeError("Invalid "+name+" output bytes")
    filename=name+ext;(OUT/filename).write_bytes(data)
    result["views"].append({"name":name,"file":filename,"bytes":len(data)})
   (OUT/"multiview-result.json").write_text(json.dumps(result,indent=2))
   print("Saved all FOUR new matching views; STOP for rig-shape review",flush=True);return
  if state in ("failed","cancelled","expired","banned"):raise RuntimeError("Failed: "+str(state)+"; never auto retry")
  time.sleep(10)
 raise RuntimeError("Timed out: task ID in logs; do not retry")
if __name__=="__main__": main()
