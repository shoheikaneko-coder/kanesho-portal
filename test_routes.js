// Firebase emulator API check using standard fetch (REST API)
async function run() {
    try {
        const res = await fetch("http://127.0.0.1:8080/v1/projects/kaneshow-portal/databases/(default)/documents/m_evaluation_routes");
        if (!res.ok) {
            console.log("No 8080", res.status);
            const res2 = await fetch("http://127.0.0.1:8081/v1/projects/kaneshow-portal/databases/(default)/documents/m_evaluation_routes");
            const data2 = await res2.json();
            console.log(JSON.stringify(data2, null, 2));
            return;
        }
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.log(e.message);
        try {
            const res2 = await fetch("http://127.0.0.1:8081/v1/projects/kaneshow-portal/databases/(default)/documents/m_evaluation_routes");
            const data2 = await res2.json();
            console.log(JSON.stringify(data2, null, 2));
        } catch(e2) {
            console.log(e2.message);
        }
    }
}
run();
