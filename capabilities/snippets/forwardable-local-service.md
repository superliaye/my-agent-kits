# Forwardable local service

- Bind only to `127.0.0.1` and choose an eligible documented port without falling back to a public listener.
- Use origin-relative asset, API, and WebSocket URLs so direct use, SSH forwarding, and host forwarding share one build.
- Keep the listener alive independently of the launching shell and expose a small health endpoint.
- Authenticate content before serving it, reject unexpected Host headers, and constrain file reads to the run root.
- Define run cleanup and an idle condition that stops the listener after its final run closes.
