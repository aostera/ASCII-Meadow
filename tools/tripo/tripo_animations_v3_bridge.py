#!/usr/bin/env python3
"""Single Tripo v3 animation request using existing v2 rig (if v3 accepts UUID).
We do NOT regenerate anything; no paid retry after submission.
"""
import json,os,time,struct
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from tripo_budget import key,balance,request_json
APPROVAL="TRIPO_APPROVE_V3_ANIMS_BRIDGE_40_CREDITS"
RIG="ad2a616c-194c-4563-a47d-acd0810bec0d"
PRESETS=["preset:idle","preset:walk","preset:run","preset:jump"]
BASE="https://openapi.tripo3d.ai/v3"
OUT=Path("artifacts/tripo-ashen-v3-four-anims")
def api(method,path,token,payload=None):
 headers={"Authorization":"Bearer "+token,"Accept":"application/json"}
 body=None
 if payload is not None:
  headers["Content-Type"]="application/json"
  body=json.dumps(payload).encode()
 req=Request(BASE+path,data=body,headers=headers,method=method)
 try:
  with urlopen(req,timeout=50) as r:return json.load(r)
 except HTTPError as e:
  print("Tripo v3 HTTP status",e.code,". No paid task will be repeated.",flush=True)
  raise
def guard():
 if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_RUN_ATTEMPT")!="1" or os.environ.get("GITHUB_REF")!="refs/heads/feat/tripo-ashen-rig-ready":
  raise RuntimeError("Tripo v3 bridge restricted to first workflow run")
 ev=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
 a=json.loads(Path("tools/tripo/approvals/anims-v3-bridge.json").read_text())
 if ev.get("head_commit",{}).get("message")!=APPROVAL or a!={"authorization":APPROVAL,"max_credits":40,"count":1,"rig_task_id":RIG,"animations":PRESETS}:
  raise RuntimeError("No one-shot approval to try v3 API")
def main():
 guard();tok=key()
 if balance(tok)<40:raise RuntimeError("Less than 40 credits")
 s=request_json("/task/"+RIG,token=tok)
 if s.get("status")!="success" or s.get("type")!="animate_rig":raise RuntimeError("Source rig missing")
 OUT.mkdir(parents=True,exist_ok=True)
 print("ONE official v3 Tripo four-animation batch. No re-rig or re-generation.",flush=True)
 ret=api("POST","/animations/retarget",tok,{
  "input":RIG,"animations":PRESETS,"out_format":"glb"})
 if ret.get("code")!=0:
  (OUT/"rejected.json").write_text(json.dumps({"code":ret.get("code"),"message":ret.get("message"),"suggestion":ret.get("suggestion")},indent=2))
  raise RuntimeError("v3 Tripo rejected existing v2 rig task; 0-credit parameter rejection")
 task=ret["data"]["task_id"];print("TRIPO_V3_ANIM_TASK_ID="+task,flush=True)
 for _ in range(120):
  obj=api("GET","/tasks/"+task,tok)
  if obj.get("code")!=0:raise RuntimeError("v3 task query error")
  d=obj["data"];status=d.get("status")
  print("v3 retarget",status,"credits",d.get("credits_consumed",d.get("consumed_credit")),flush=True)
  if status=="success":
   url=(d.get("output") or {}).get("model_url") or (d.get("output") or {}).get("model")
   if not url or not url.startswith("https://"):
    (OUT/"output-keys.json").write_text(json.dumps({"task":task,"keys":list((d.get("output") or {}).keys())},indent=2))
    raise RuntimeError("v3 success but missing GLB url")
   with urlopen(url,timeout=110) as resp:raw=resp.read(155000000)
   if raw[:4]!=b"glTF":raise RuntimeError("v3 output not GLB")
   (OUT/"The_Ashen_Vow_Tripo_V3_four_anims.glb").write_bytes(raw)
   size,typ=struct.unpack_from("<I4s",raw,12)
   j=json.loads(raw[20:20+size]);clips=[c.get("name") for c in j.get("animations",[])];skins=[len(s["joints"]) for s in j.get("skins",[])]
   (OUT/"result.json").write_text(json.dumps({"task_id":task,"credits":d.get("credits_consumed"),"clips":clips,"skins":skins},indent=2))
   print("v3 retarget output clips",clips,"skins",skins,flush=True)
   if len(clips)<4 or not skins:raise RuntimeError("GLB incomplete; never bill retry")
   return
  if status in ("failed","cancelled"):
   raise RuntimeError("Tripo v3 task failed; error "+str(d.get("error_code"))+"; cost "+str(d.get("credits_consumed"))+"; no retry")
  time.sleep(10)
 raise RuntimeError("Timed out, task id in logs; no retry")
if __name__=="__main__":main()
