import urllib.request
import json

project = "kaneshow-portal"

url_users = f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/m_users?pageSize=1000"
req = urllib.request.Request(url_users)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    
target_ids = []
for doc in data.get('documents', []):
    fields = doc.get('fields', {})
    name = fields.get('Name', {}).get('stringValue', '')
    if name == 'グエン　チ　タイン':
        doc_id = doc['name'].split('/')[-1]
        emp_code = fields.get('EmployeeCode', {}).get('stringValue', '')
        target_ids.extend([doc_id, emp_code])

query = {
    "structuredQuery": {
        "from": [{"collectionId": "t_attendance"}],
        "where": {
            "compositeFilter": {
                "op": "AND",
                "filters": [
                    {
                        "fieldFilter": {
                            "field": {"fieldPath": "date"},
                            "op": "GREATER_THAN_OR_EQUAL",
                            "value": {"stringValue": "2026-05-29"}
                        }
                    },
                    {
                        "fieldFilter": {
                            "field": {"fieldPath": "date"},
                            "op": "LESS_THAN_OR_EQUAL",
                            "value": {"stringValue": "2026-05-31"}
                        }
                    }
                ]
            }
        },
        "limit": 5000
    }
}

url_query = f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents:runQuery"
req = urllib.request.Request(url_query, data=json.dumps(query).encode('utf-8'), headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as response:
    docs = json.loads(response.read().decode())
    for item in docs:
        doc = item.get('document')
        if not doc: continue
        fields = doc.get('fields', {})
        
        pid = ""
        for k in ['staff_id', 'staff_code', 'EmployeeCode', 'UserId']:
            val = fields.get(k, {}).get('stringValue', '')
            if val:
                pid = val
                break
                
        if pid in target_ids:
            print(f"--- {fields.get('date', {}).get('stringValue', '')} {fields.get('timestamp', {}).get('stringValue', '')} {fields.get('type', {}).get('stringValue', '')} ---")
            
