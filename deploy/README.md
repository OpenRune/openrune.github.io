# Deployment

`.github/workflows/release.yml` builds the site and deploys it over SSH to the same box as the
OpenRune APIs and the 117HD discord bot, behind the same Cloudflare tunnel.

Triggered by a push to `production`, or manually.

## What ends up on the server

```
/opt/openrune-site/
  current/            the live release (server.js, .next, node_modules, public)
  previous/           the one before it, for a manual rollback
  server.js           symlink into current/
  site.env            config, chmod 600
```

`next.config.ts` sets `output: "standalone"`, so the build emits a self-contained server with a
trimmed `node_modules`. Next deliberately leaves `.next/static` and `public` out of that bundle —
it assumes a CDN serves them — so the workflow copies them in beside the server before packing.

Releases are unpacked to a staging directory and swapped, so a half-extracted bundle is never live
and stale files from the previous build cannot linger. Roll back by hand with:

```bash
cd /opt/openrune-site && rm -rf current && mv previous current && systemctl restart openrune-site
```

## Tunnel

The site is **not** exposed on a port. `cloudflared` routes `openrune.dev` and `www.openrune.dev`
to `127.0.0.1:3000`; the service binds to loopback only.

That ingress lives in the **API repo** (`OpenRune-WebServer/deploy/cloudflared-config.yml`) along
with the `osrs.` and `rs3.` routes, so one deploy owns the tunnel config rather than two fighting
over the same file. Changing the site's hostname or port means editing it there.

## Environment

### GitHub secrets

| secret | required | what it is |
|--------|----------|------------|
| `SSH_HOST` | yes | the box, same value the API and bot repos use |
| `SSH_USER` | yes | SSH user |
| `SSH_PRIVATE_KEY` | yes | SSH private key |
| `SSH_PORT` | yes | SSH port |
| `OSRS_CACHE_UPSTREAM` | recommended | `http://127.0.0.1:8090` |
| `RS3_CACHE_UPSTREAM` | recommended | `http://127.0.0.1:8091` |

Nothing else. The site has no database, no API keys and no CDN credentials of its own.

### What ends up in `site.env` on the server

Written fresh by every deploy, chmod 600:

| variable | value | why |
|----------|-------|-----|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | the port cloudflared routes `openrune.dev` to |
| `HOSTNAME` | `127.0.0.1` | binds to loopback, so the only way in is the tunnel |
| `OSRS_CACHE_UPSTREAM` | from the secret | see below |
| `RS3_CACHE_UPSTREAM` | from the secret | see below |

**Why the upstreams matter.** `src/lib/cache-api-target.ts` maps `osrs.openrune.dev` →
`OSRS_CACHE_UPSTREAM`. Without it, server-side rendering calls the API at its public hostname,
which means leaving the box, through Cloudflare, through the tunnel, and back to a port on the same
machine. Pointing it at `http://127.0.0.1:8090` keeps that traffic local. It is read **server-side
only** — the browser always uses the public hostname, which is what you want.

### Build-time only

`NEXT_PUBLIC_IS_LOCAL` adds the "Localhost" cache target to the picker. Like every `NEXT_PUBLIC_*`
variable it is **inlined when the bundle is built**, so putting it in `site.env` does nothing — it
would have to be set on the build job. Leave it unset for production; the picker already hides the
local option when `NODE_ENV=production` and the hostname is not localhost.

## Checking on it

```bash
systemctl status openrune-site
journalctl -u openrune-site -f
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
curl -sS -o /dev/null -w '%{http_code}\n' https://openrune.dev/
```

## History

This replaced `production-restart.yml`, which restarted a Pterodactyl server on push to
`production`. The site now runs as a systemd service on the same box as the APIs, reachable only
through the tunnel.
