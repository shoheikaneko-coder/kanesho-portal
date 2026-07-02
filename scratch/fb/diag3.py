import urllib.request
import json

project = "kaneshow-portal"

# 1. Fetch Nguyen from m_users
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
        print(f"Found Nguyen: doc_id={doc_id}, emp_code={emp_code}")

# 2. Fetch attendance via structured query
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
                            "value": {"stringValue": "2026-04-30"}
                        }
                    },
                    {
                        "fieldFilter": {
                            "field": {"fieldPath": "date"},
                            "op": "LESS_THAN_OR_EQUAL",
                            "value": {"stringValue": "2026-06-01"}
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
try:
    with urllib.request.urlopen(req) as response:
        docs = json.loads(response.read().decode())
        found = 0
        for item in docs:
            doc = item.get('document')
            if not doc: continue
            fields = doc.get('fields', {})
            
            # Extract IDs
            pid = ""
            for k in ['staff_id', 'staff_code', 'EmployeeCode', 'UserId']:
                val = fields.get(k, {}).get('stringValue', '')
                if val:
                    pid = val
                    break
                    
            if pid in target_ids:
                d = fields.get('date', {}).get('stringValue', '')
                if d == '2026-05-30' or d == '2026-05-31':
                    print(f"Found Punch: {doc['name'].split('/')[-1]}")
                    print(json.dumps(fields, ensure_ascii=False, indent=2))
                    found += 1
        print(f"Total found for 05-30/31: {found}")
except Exception as e:
    print(e)
    
