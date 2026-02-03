# Prototype Application

This prototype demonstrates the revised plan's tenant-aware generation flow:

- **Edge-style routing:** tenant selection drives configuration and model metadata.
- **LLM gateway stub:** `/api/generate` simulates response shaping + guardrails.
- **Validation:** forbidden patterns trigger warnings in the response.
- **Audit trail:** UI logs trace IDs for observability.

## Run locally

```bash
python3 server.py
```

Then open http://localhost:8000 in a browser.
