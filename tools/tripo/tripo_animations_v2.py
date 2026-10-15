#!/usr/bin/env python3
"""Tripo only. Retarget exactly four gameplay animation presets in ONE 40-credit job.
Source is the already-paid Tripo v2.5 40-bone skinned knight.
No second POST, no auto-retries, no hidden animation extras.
"""
import json,os,struct,time
from pathlib import Path
from urllib.request import urlopen
from tripo_budget import key,balance,request_json
AUTH="TRIPO_APPROVE_FOUR_ANIMS_V2_40_CREDITS"
RIG_TASK="ad2a616c-194c-4563-a47d-acd0810bec0d"
PRESETS=["preset:idle","preset:walk","preset:run","preset:jump"]
OUT=Path("artifacts/tripo-ashen-v2-four-anims")
def verify_authorization():
 if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_REF")!="refs/heads/feat/tripo-ashen-rig-ready" or os.environ.get("GITHUB_RUN_ATTEMPT")!="1":
  raise RuntimeError("Only original GitHub Actions feature-branch run")
 ev=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
 a=json.loads(Path("tools/tripo/approvals/anims-v2.json").read_text())
 if ev.get("head_commit",{}).get("message")!=AUTH or a!={"authorization":AUTH,"max_credits":40,"count":1,"rig_task_id":RIG_TASK,"animations":PRESETS}:
  raise RuntimeError("No one-time explicit animation authorization")
def main():
 verify_authorization();token=key()
 if balance(token)<40:raise RuntimeError("Not enough Tripo credits for 4 animations")
 upstream=request_json("/task/"+RIG_TASK,token=token)
 if upstream.get("status")!="success" or upstream.get("type")!="animate_rig":
  raise RuntimeError("Rig not confirmed complete; no paid retargeting")
 OUT.mkdir(parents=True,exist_ok=True)
 data={"type":"animate_retarget","original_model_task_id":RIG_TASK,
  "out_format":"glb","animations":PRESETS,"bake_animation":True,
  "export_with_geometry":True,"animate_in_place":True}
 print("Submitting ONE Tripo motion retarget task: Idle Walk Run Jump, max 40 credits.",flush=True)
 task=request_json("/task",data=data,token=token)
 tid=task["task_id"];print("TRIPO_V2_FOUR_ANIMS_TASK_ID="+tid,flush=True)
 for i in range(120):
  st=request_json("/task/"+tid,token=token);status=st.get("status")
  print("Retarget status "+str(status)+" credits "+str(st.get("consumed_credit","?")),flush=True)
  if status=="success":
   output=st.get("output") or {}
   url=output.get("model") or output.get("base_model")
   if not isinstance(url,str) or not url.startswith("https://"):
    (OUT/"output-keys.json").write_text(json.dumps({"task_id":tid,"fields":list(output)},indent=2))
    raise RuntimeError("No model URL in animation output; no paid repeat")
   with urlopen(url,timeout=120) as response:raw=response.read(150000000)
   if raw[:4]!=b"glTF":raise RuntimeError("Animation output is not GLB. Do NOT repeat.")
   path=OUT/"The_Ashen_Vow_V2_TRIPO_Idle_Walk_Run_Jump.glb"
   path.write_bytes(raw)
   length,typ=struct.unpack_from("<I4s",raw,12)
   js=json.loads(raw[20:20+length])
   names=[x.get("name","") for x in js.get("animations",[])]
   skins=[len(s.get("joints",[])) for s in js.get("skins",[])]
   result={"task_id":tid,"rig_task_id":RIG_TASK,"credits":st.get("consumed_credit"),
    "requested":PRESETS,"clip_names":names,"clip_count":len(names),
    "skins":len(skins),"joints":skins,"bytes":len(raw),"in_place":True}
   (OUT/"animation-inspection.json").write_text(json.dumps(result,indent=2))
   print("Animations returned, clip names:",names,"bones",skins,"bytes",len(raw),flush=True)
   if len(names)<4 or not skins:raise RuntimeError("GLB does NOT contain 4 clips and skeleton; flagged for review, NO extra paid requests")
   print("SUCCESS: Tripo game-ready 40-bone knight with 4 skeletal animations",flush=True);return
  if status in ("failed","cancelled","banned","expired"):raise RuntimeError("Tripo task failed. No paid retries")
  time.sleep(10)
 raise RuntimeError("Timed out; task ID logged, no auto paid retries")
if __name__=="__main__":main()
