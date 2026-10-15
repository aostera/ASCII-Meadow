#!/usr/bin/env python3
"""ONE MINIMAL Tripo v2 retarget with only the REQUIRED params, to avoid 1004.
Failed prior batch consumed ZERO credits. Success spends only 10.
"""
import json,os,time,struct
from pathlib import Path
from urllib.request import urlopen
from tripo_budget import key,balance,request_json
AUTH="TRIPO_APPROVE_IDLE_V2_10_CREDITS"
UP="ad2a616c-194c-4563-a47d-acd0810bec0d"
OUT=Path("artifacts/tripo-ashen-v2-idle")
def main():
 if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_RUN_ATTEMPT")!="1" or os.environ.get("GITHUB_REF")!="refs/heads/feat/tripo-ashen-rig-ready":
  raise RuntimeError("Not original approved Tripo GH Action")
 evt=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
 approved=json.loads(Path("tools/tripo/approvals/idle-v2.json").read_text())
 if evt.get("head_commit",{}).get("message")!=AUTH or approved!={"authorization":AUTH,"max_credits":10,"count":1,"rig_task_id":UP,"animation":"preset:idle"}:
  raise RuntimeError("No explicit one-time 10-credit idle authorization")
 tok=key()
 if balance(tok)<10:raise RuntimeError("Less than 10 credits, abort")
 rig=request_json("/task/"+UP,token=tok)
 if rig.get("status")!="success" or rig.get("type")!="animate_rig":raise RuntimeError("Rig source not success")
 payload={"type":"animate_retarget","original_model_task_id":UP,"animation":"preset:idle"}
 print("Submitting ONE minimal Tripo idle animation using documented required keys only",flush=True)
 task=request_json("/task",data=payload,token=tok)
 tid=task["task_id"];print("TRIPO_V2_IDLE_TASK_ID="+tid,flush=True)
 OUT.mkdir(parents=True,exist_ok=True)
 for _ in range(120):
  st=request_json("/task/"+tid,token=tok)
  status=st.get("status")
  print("Idle retarget "+str(status)+" credits "+str(st.get("consumed_credit","?"))+" error_code "+str(st.get("error_code","")),flush=True)
  if status=="success":
   output=st.get("output") or {}
   url=output.get("model") or output.get("base_model")
   if not isinstance(url,str) or not url.startswith("https://"):
    (OUT/"missing-output.json").write_text(json.dumps({"task_id":tid,"keys":list(output)},indent=2))
    raise RuntimeError("Task succeeded, no GLB URL. Do not repeat paid request")
   with urlopen(url,timeout=120) as response:raw=response.read(145000000)
   if raw[:4]!=b"glTF":raise RuntimeError("Retarget did not return GLB")
   (OUT/"The_Ashen_Vow_V2_IDLE.glb").write_bytes(raw)
   sz,typ=struct.unpack_from("<I4s",raw,12)
   meta=json.loads(raw[20:20+sz])
   names=[c.get("name") for c in meta.get("animations",[])]
   joints=[len(s.get("joints",[])) for s in meta.get("skins",[])]
   (OUT/"idle-task.json").write_text(json.dumps({
    "task_id":tid,"consumed_credit":st.get("consumed_credit"),
    "clip_names":names,"skins":joints,"bytes":len(raw)
   },indent=2))
   print("Tripo idle output: clips",names,"joints",joints,"success",flush=True)
   if not names or not joints:raise RuntimeError("GLB lacks actual skinned skeletal animation")
   return
  if status in ["failed","cancelled","expired","banned"]:
   raise RuntimeError("Tripo idle failed error_code="+str(st.get("error_code"))+" credits="+str(st.get("consumed_credit"))+"; no auto retry")
  time.sleep(10)
 raise RuntimeError("Timeout, task ID above. NO auto repeat")
if __name__=="__main__":main()
