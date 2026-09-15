# Mini-RDC

Personal Remote Desktop Commander for Termux.

## Goals

- Browser dashboard for the local Termux environment.
- Fast file search using ripgrep (`rg`).
- Structured filesystem, Git, process, and command tools.
- MCP interface for remote ChatGPT connectivity.
- Secure, authenticated remote mode.
- Keep the project independent from existing repositories.

## Local development

```bash
npm start
```

Then open `http://127.0.0.1:8787`.

## Roadmap

1. Core HTTP server and health checks.
2. `rg` file search and filesystem tools.
3. Browser terminal/dashboard.
4. MCP Streamable HTTP server.
5. Secure remote connection and pairing.
