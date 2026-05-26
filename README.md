# pi-services

Tiny web dashboard to manage systemd services on a Raspberry Pi.  Two views:

- **Custom** — curated services dropped in `/etc/pi-services/enabled/` (symlinks).
- **All units** — every `.service` known to systemd, with filter + hide-inactive.

Per service: live state, last log line, **start / stop / restart / reload**,
historical logs (journalctl), and a live tail over WebSocket.

Built to live alongside [wifi-radar](https://github.com/BugQuest/wifi-radar) on
the same Pi.  No auth: bind it on the LAN only.

## Stack

- Backend: FastAPI + uvicorn, async subprocess wrappers around `systemctl` /
  `journalctl`.  Strict unit-name validation, allowlisted lifecycle verbs.
- Frontend: React + TypeScript + Vite + Tailwind.
- Privileges: a single `sudoers.d` snippet grants the dashboard user
  passwordless `systemctl start|stop|restart|reload` (any unit).
- Self-hosting: ships with its own `pi-services.service` and an install script.

## Install on the Pi

```bash
git clone git@github.com:BugQuest/pi-services.git ~/pi-services
cd ~/pi-services

# build the frontend (locally on your dev machine or on the Pi)
cd frontend && npm install && npm run build && cd ..
cp -r frontend/dist static

# run the installer (creates venv, installs units + sudoers, enables service)
bash deploy/install.sh
```

After that the dashboard is at `http://<pi>:8001/`.

### Adding a service to the Custom tab

Anything symlinked under `/etc/pi-services/enabled/` appears there:

```bash
sudo ln -sfn /etc/systemd/system/my-service.service /etc/pi-services/enabled/
```

Remove it the same way (`sudo rm /etc/pi-services/enabled/my-service.service`).

### Convert wifi-radar (nohup) to systemd

Once `wifi-radar.service` is installed by `install.sh`, drop the old nohup
process and let systemd take over:

```bash
pkill -9 -f 'uvicorn app.main:app' || true
sudo systemctl enable --now wifi-radar.service
```

You can now manage it from the dashboard like any other unit.

## Dev loop

Two terminals:

```bash
# terminal 1 — backend
python -m venv .venv
.venv/bin/pip install -e .
PI_SERVICES_ENABLED_DIR=/tmp/pi-services-enabled \
  .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Vite serves on `http://localhost:5174` with `/api` and `/ws` proxied to
`localhost:8001`.

On a non-systemd dev box the `systemctl`/`journalctl` calls return empty
results; you'll see real data once running on the Pi.

## API

| Method | Path                              | Notes                                          |
|--------|-----------------------------------|------------------------------------------------|
| GET    | `/api/services`                   | Curated (drop-in folder)                       |
| GET    | `/api/services/all`               | Every `.service` unit                          |
| GET    | `/api/services/{name}`            | Single status                                  |
| POST   | `/api/services/{name}/{action}`   | action ∈ start, stop, restart, reload          |
| GET    | `/api/services/{name}/logs`       | `?lines=200` (max 5000)                        |
| WS     | `/ws/services/{name}/logs`        | Live tail via `journalctl -f`                  |
| GET    | `/health`                         | Liveness probe                                 |

Unit names are validated against `^[A-Za-z0-9@:._-]+\.(service|timer|socket|target|path)$`.

## Security notes

- No authentication. **Only expose to a trusted LAN.**
- The sudoers snippet grants `systemctl start|stop|restart|reload *` to the
  dashboard user.  An attacker on the LAN could stop any service, but not run
  arbitrary commands — the dashboard never shells out a unit name without
  validating it first, and sudoers locks the verb.
- If you need stronger guarantees, drop a reverse proxy with basic auth in
  front, or move to `systemctl --user` for a single-user scope.

## License

GPLv3.
