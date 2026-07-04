# CraftHost

CraftHost is a lightweight Minecraft server manager that can create per-user isolated instances, automatically start servers on login, expose TCP tunnels using ngrok, and provide a simple web UI for control.

Important: This project is a development prototype. To run in production you must review the security and infrastructure notes below.

Quick start (development):

```bash
# install dependencies
npm install

# run backend
node backend/api.cjs

# in another terminal run frontend
npm run dev
```

Environment variables
- `JWT_SECRET` — secret for signing JWT tokens (set in production)
 - `JWT_SECRET` — secret for signing JWT tokens (set in production)
 - `CLOUDFLARE_TOKEN` and `CLOUDFLARE_ZONE` — optional, if you use Cloudflare DNS the app can create SRV records so user domains remain stable even when the tunnel host/port changes.

Production notes (recommended):
- Use a real database instead of file-based `users.json` and `servers.json`.
- Run behind a reverse proxy (NGINX) with HTTPS.
- Use PM2 or Docker to manage processes (see `ecosystem.config.js` and `Dockerfile`).
- Consider replacing ngrok with a self-hosted TCP tunnel or reserve ngrok paid plan for stable addresses.
- Enforce resource limits per-instance and use swap/monitoring to avoid host OOM.
- Add backups to remote storage (S3) instead of local `backups/` folder.

Security
- The app uses Helmet and rate-limiting, but you should enable HTTPS, strong JWT secret, and consider 2FA for user accounts.
- Do not expose the management API to the public internet without auth and reverse proxy protections.

Scaling
- For many concurrent users, deploy each instance into a container (Docker) and orchestrate with Kubernetes or use PM2 and multiple hosts.

Stable domain mapping (IP/port changes):
- Minecraft clients support SRV DNS records. The manager can create SRV records (via Cloudflare API) that point `_minecraft._tcp.<user>.yourdomain` to the current tunnel host and port. Configure `CLOUDFLARE_TOKEN` and `CLOUDFLARE_ZONE` to enable this. This keeps the visible domain stable for players while the underlying tunnel endpoint changes.

Limitations
- Free ngrok may limit tunnels and concurrent connections.
- The server copies the template `backend/server` directory to instantiate per-user servers; ensure licenses for server software comply.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
