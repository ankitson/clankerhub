#!/usr/bin/env python3
"""Minimal prototype server for the revised AI app platform plan."""
from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
TENANT_CONFIG_PATH = ROOT / "tenant_config.json"

FORBIDDEN_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [r"<script", r"eval\s*\(", r"new\s+Function", r"document\.write"]
]


@dataclass
class TenantConfig:
    tenant_id: str
    display_name: str
    allow_scripts: bool
    model: str


def load_tenant_configs() -> dict[str, TenantConfig]:
    raw = json.loads(TENANT_CONFIG_PATH.read_text())
    configs: dict[str, TenantConfig] = {}
    for entry in raw.get("tenants", []):
        configs[entry["tenantId"]] = TenantConfig(
            tenant_id=entry["tenantId"],
            display_name=entry["displayName"],
            allow_scripts=entry.get("allowScripts", False),
            model=entry.get("model", "mock-gpt"),
        )
    return configs


def validate_html(html: str, allow_scripts: bool) -> list[str]:
    warnings: list[str] = []
    if allow_scripts:
        return warnings
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(html):
            warnings.append(f"Blocked pattern detected: {pattern.pattern}")
    return warnings


def generate_html(prompt: str, tenant: TenantConfig) -> str:
    safe_prompt = prompt.replace("<", "&lt;").replace(">", "&gt;")
    return f"""
    <main>
      <h1>{tenant.display_name} Builder Preview</h1>
      <section>
        <h2>Prompt</h2>
        <p>{safe_prompt}</p>
      </section>
      <section>
        <h2>Generated UI</h2>
        <div class=\"card\">
          <h3>Welcome back!</h3>
          <p>Your model: {tenant.model}</p>
          <button>Review changes</button>
        </div>
      </section>
    </main>
    """.strip()


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class PrototypeHandler(BaseHTTPRequestHandler):
    server_version = "PrototypeHTTP/0.1"

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/":
            self.serve_static("index.html")
            return
        if self.path.startswith("/static/"):
            self.serve_static(self.path.replace("/static/", ""))
            return
        if self.path == "/api/tenants":
            configs = load_tenant_configs()
            payload = {
                "tenants": [
                    {
                        "tenantId": cfg.tenant_id,
                        "displayName": cfg.display_name,
                        "allowScripts": cfg.allow_scripts,
                        "model": cfg.model,
                    }
                    for cfg in configs.values()
                ]
            }
            json_response(self, HTTPStatus.OK, payload)
            return
        json_response(self, HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/generate":
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON"})
            return
        tenant_id = self.headers.get("X-Tenant-ID") or payload.get("tenantId")
        if not tenant_id:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Missing tenantId"})
            return
        configs = load_tenant_configs()
        tenant = configs.get(tenant_id)
        if not tenant:
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Unknown tenant"})
            return
        prompt = str(payload.get("prompt", ""))
        html = generate_html(prompt, tenant)
        warnings = validate_html(html, tenant.allow_scripts)
        response = {
            "tenantId": tenant.tenant_id,
            "generatedAt": time.time(),
            "html": html,
            "warnings": warnings,
            "traceId": f"trace-{int(time.time() * 1000)}",
        }
        json_response(self, HTTPStatus.OK, response)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def serve_static(self, filename: str) -> None:
        path = STATIC_DIR / filename
        if not path.exists():
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Missing asset"})
            return
        content = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Length", str(len(content)))
        if filename.endswith(".css"):
            self.send_header("Content-Type", "text/css")
        elif filename.endswith(".js"):
            self.send_header("Content-Type", "application/javascript")
        else:
            self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(content)


def run() -> None:
    port = int(os.environ.get("PORT", "8000"))
    server = HTTPServer(("0.0.0.0", port), PrototypeHandler)
    print(f"Prototype server listening on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
