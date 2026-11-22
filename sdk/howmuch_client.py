"""Local HowMuch client. Standard library only; no provider credentials needed."""
import json
from urllib.parse import quote
from urllib.request import Request, urlopen

class HowMuchClient:
    def __init__(self, endpoint="http://127.0.0.1:8787", timeout=185):
        self.endpoint, self.timeout = endpoint.rstrip("/"), timeout

    def _post(self, path, payload):
        req = Request(self.endpoint + path, data=json.dumps(payload).encode(),
                      headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=self.timeout) as res:
            return json.load(res)

    def research(self, payload):
        return self._post("/api/research", payload)

    def start_job(self, payload):
        return self._post("/api/jobs", payload)

    def events(self, job_id):
        path = "/api/jobs/" + quote(job_id, safe="") + "/events"
        with urlopen(self.endpoint + path, timeout=self.timeout) as res:
            for line in res:
                if line.startswith(b"data: "):
                    yield json.loads(line[6:])
