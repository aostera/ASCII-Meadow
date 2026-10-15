"""FREE read-only Tripo failure inspection. Makes NO POST requests, zero credits."""
from tripo_budget import key,request_json
import json
TASK="56ec3a0c-324b-4bc7-8dc0-16f7bf607021"
d=request_json("/task/"+TASK,token=key())
print("TRIPO_ANIM_FAILURE_DIAG_JSON",json.dumps({
  "task_id":TASK,"status":d.get("status"),"consumed_credit":d.get("consumed_credit"),
  "error":d.get("error"),"error_message":d.get("error_message"),
  "message":d.get("message"),"code":d.get("code"),"error_code":d.get("error_code"),"result":d.get("result"),"upstream_input":{k:v for k,v in (d.get("input") or {}).items() if k in ("animations","animation","animate_in_place","out_format")},
  "output_keys":list(d.get("output") or {}),
  "output":{k:v for k,v in (d.get("output") or {}).items() if "url" not in k.lower()},
  "extra_keys":list(d.keys())
},ensure_ascii=False))

# Safe read-only diagnostic triggered after workflow installation.
