#!/usr/bin/env python3
"""Tripo only: ONE 20-credit rig-ready Gothic knight model from Tripo-generated four views."""
import json,os,time
from pathlib import Path
from urllib.request import urlopen
from tripo_budget import key,balance,request_json
AUTH="TRIPO_APPROVE_RIG_MODEL_V2_20_CREDITS"
SOURCE_MULTIVIEW_TASK="f4473540-3bdf-421e-80c3-edb089176acf"
OUT=Path("artifacts/tripo-ashen-rig-v2-model")
def main():
 if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_REF")!="refs/heads/feat/tripo-ashen-rig-ready" or os.environ.get("GITHUB_RUN_ATTEMPT")!="1":
  raise RuntimeError("Protected one-shot CI only")
 ev=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
 a=json.loads(Path("tools/tripo/approvals/model-v2.json").read_text())
 if ev.get("head_commit",{}).get("message")!=AUTH or a!={"authorization":AUTH,"max_credits":20,"count":1,"source_multiview_task_id":SOURCE_MULTIVIEW_TASK,"model":"v3.1-20260211"}:
  raise RuntimeError("No explicit single-model approval.")
 token=key()
 if balance(token)<20:raise RuntimeError("Insufficient 20 credits")
 source=request_json("/task/"+SOURCE_MULTIVIEW_TASK,token=token)
 if source.get("status")!="success" or source.get("type")!="generate_multiview_image":
  raise RuntimeError("Validated rig reference multi-view task is not successful; refuse charge")
 data={"type":"multiview_to_model","model_version":"v3.1-20260211",
       "original_task_id":SOURCE_MULTIVIEW_TASK,"texture":False,"pbr":False,
       "geometry_quality":"standard","orthographic_projection":True}
 print("Submitting exactly ONE v3.1 standard UNTEXTURED model from same-pose Tripo views",flush=True)
 task=request_json("/task",data=data,token=token);tid=task["task_id"]
 print("TRIPO_RIG_V2_MODEL_TASK_ID="+tid,flush=True)
 OUT.mkdir(parents=True,exist_ok=True)
 for i in range(120):
  st=request_json("/task/"+tid,token=token)
  status=st.get("status")
  print("New sword-free 3D model status="+str(status)+" credits="+str(st.get("consumed_credit","?")),flush=True)
  if status=="success":
   out=st.get("output") or {}
   url=out.get("base_model") or out.get("model")
   if not isinstance(url,str) or not url.startswith("https://"):
    (OUT/"result-fields.json").write_text(json.dumps({"task_id":tid,"output_keys":list(out)}))
    raise RuntimeError("Tripo completed but GLB URL absent. Never paid-retry.")
   with urlopen(url,timeout=110) as response:raw=response.read(145000000)
   if raw[:4]!=b"glTF":raise RuntimeError("Not a GLB. Never paid-retry.")
   (OUT/"The_Ashen_Vow_Tripo_RIG_READY_V2.glb").write_bytes(raw)
   result={"task_id":tid,"source_multiview_task_id":SOURCE_MULTIVIEW_TASK,
           "credits":st.get("consumed_credit"),"size_bytes":len(raw),
           "riggable":out.get("riggable"),"rig_type":out.get("rig_type"),
           "animated":False}
   (OUT/"model-task.json").write_text(json.dumps(result,indent=2))
   print("NEW TRUE 3D sword-free rig candidate downloaded: "+str(len(raw))+" bytes",flush=True)
   print("STOP. Inspect 3D mesh before rig or animation credit.",flush=True);return
  if status in ("failed","cancelled","banned","expired"):raise RuntimeError("Model failed; no automatic retry")
  time.sleep(10)
 raise RuntimeError("Polling timeout; task ID in logs. Do not re-run billable POST")
if __name__=="__main__":main()
