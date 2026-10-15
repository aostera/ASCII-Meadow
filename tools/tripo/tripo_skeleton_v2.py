#!/usr/bin/env python3
"""Tripo ONLY rig pipeline: FREE pre-rig check, then ONE max-25-credit biped bind.
No paid retries. Mesh processing and skeleton both performed by Tripo itself.
"""
import json,os,time
from pathlib import Path
from urllib.request import urlopen
from tripo_budget import key,balance,request_json
AUTH="TRIPO_APPROVE_BIPED_RIG_V2_25_CREDITS"
MODEL="3b8f523b-9717-460b-acfb-e8612060e5ca"
OUT=Path("artifacts/tripo-ashen-rig-v2-skeleton")
def poll(tid,token,what):
 for i in range(110):
  st=request_json("/task/"+tid,token=token)
  status=st.get("status")
  print(what+" "+str(status)+" credit="+str(st.get("consumed_credit","?")),flush=True)
  if status=="success":return st
  if status in ("failed","cancelled","banned","expired"):raise RuntimeError(what+" failed; NO PAID RETRIES")
  time.sleep(10)
 raise RuntimeError("Timed out on "+what+". Task ID above, no paid retry")
def guard():
 if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_REF")!="refs/heads/feat/tripo-ashen-rig-ready" or os.environ.get("GITHUB_RUN_ATTEMPT")!="1":
  raise RuntimeError("One-shot GitHub Actions only.")
 ev=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
 req=json.loads(Path("tools/tripo/approvals/rig-v2.json").read_text())
 if ev.get("head_commit",{}).get("message")!=AUTH or req!={"authorization":AUTH,"max_credits":25,"count":1,"original_model_task_id":MODEL,"rig_version":"v2.5-20260210"}:
  raise RuntimeError("No one-shot rigging authorization.")
def main():
 guard();token=key();available=balance(token)
 if available<25:raise RuntimeError("Insufficient Tripo credits for rigging")
 model=request_json("/task/"+MODEL,token=token)
 if model.get("status")!="success" or model.get("type")!="multiview_to_model":
  raise RuntimeError("Upstream 3D geometry task must have succeeded")
 OUT.mkdir(parents=True,exist_ok=True)
 print("Running FREE official Tripo animate_prerigcheck before any paid rigging.",flush=True)
 pre=request_json("/task",data={"type":"animate_prerigcheck","original_model_task_id":MODEL},token=token)
 preid=pre["task_id"];print("TRIPO_PRERIGCHECK_TASK_ID="+preid,flush=True)
 checked=poll(preid,token,"prerigcheck")
 found=checked.get("output") or {}
 riggable=found.get("riggable",checked.get("riggable"))
 (OUT/"prerigcheck.json").write_text(json.dumps({
  "task_id":preid,"riggable":riggable,"rig_type":found.get("rig_type"),
  "output_keys":list(found)
 },indent=2))
 if riggable is not True:
  print("STOP: riggable is NOT explicitly true. No paid rig requested.",flush=True)
  return
 print("Source verified BIPED riggable. Submitting ONE 25-credit Tripo skeletal bind v2.5",flush=True)
 task=request_json("/task",data={"type":"animate_rig","original_model_task_id":MODEL,
       "model_version":"v2.5-20260210","rig_type":"biped","spec":"tripo","out_format":"glb"},token=token)
 tid=task["task_id"];print("TRIPO_RIG_V2_TASK_ID="+tid,flush=True)
 done=poll(tid,token,"Tripo biped bind")
 output=done.get("output") or {}
 url=output.get("model") or output.get("base_model")
 if not isinstance(url,str) or not url.startswith("https://"):
  (OUT/"rig-output-fields.json").write_text(json.dumps({"task_id":tid,"keys":list(output)}))
  raise RuntimeError("Rig result missing GLB URL; DO NOT rerun paid task")
 with urlopen(url,timeout=100) as response:raw=response.read(145000000)
 if raw[:4]!=b"glTF":raise RuntimeError("Rigged asset not GLB; no paid retries")
 (OUT/"The_Ashen_Vow_TRIPO_V2_SKELETON.glb").write_bytes(raw)
 (OUT/"rig-task.json").write_text(json.dumps({"task_id":tid,
       "original_model_task_id":MODEL,"credits":done.get("consumed_credit"),
       "file_size":len(raw),"rig_version":"v2.5-20260210"},indent=2))
 print("SUCCESS: saved real Tripo 3D knight with real biped skeleton",len(raw),"bytes",flush=True)
if __name__=="__main__":main()
