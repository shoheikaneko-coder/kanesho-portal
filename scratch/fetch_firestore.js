async function run() {
    const projectId = "kaneshow-portal";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const body = {
        structuredQuery: {
            from: [{ collectionId: "t_attendance" }],
            where: {
                compositeFilter: {
                    op: "AND",
                    filters: [
                        { fieldFilter: { field: { fieldPath: "date" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: "2026-07-01" } } },
                        { fieldFilter: { field: { fieldPath: "date" }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: "2026-09-04" } } }
                    ]
                }
            },
            limit: 50
        }
    };
    
    const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
    });
    
    const data = await res.json();
    console.log("Hyphen results:", data.length);
    if (data[0] && data[0].document) {
        console.log("Sample:", data[0].document.fields);
    }
}
run();
