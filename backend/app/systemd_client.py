"""Async wrapper around systemctl/journalctl.

All commands are launched with `asyncio.subprocess.create_subprocess_exec` to
avoid shell injection.  Unit names are validated against a strict regex before
ever being passed to a subprocess.

The dashboard manages a curated drop-in folder at ``/etc/pi-services/enabled``.
Files in that folder are symlinks pointing to ``.service`` units (anywhere on
disk).  Only the *basename* of the symlink (the unit name) is exposed to the
API.
"""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncIterator, Iterable

# Where curated services are dropped (symlinks named like ``wifi-radar.service``).
ENABLED_DIR = Path(os.environ.get("PI_SERVICES_ENABLED_DIR", "/etc/pi-services/enabled"))

# A unit name like ``wifi-radar.service`` or ``foo@1.timer``.  We accept service,
# timer, socket, target and path units — anything else is rejected.
_UNIT_RE = re.compile(r"^[A-Za-z0-9@:._-]+\.(service|timer|socket|target|path)$")

# Actions the dashboard is allowed to forward to systemctl.  Anything else is
# rejected at the API layer too, but defence-in-depth.
_ALLOWED_ACTIONS = {"start", "stop", "restart", "reload"}


def is_valid_unit(name: str) -> bool:
    return bool(_UNIT_RE.match(name))


@dataclass
class ServiceStatus:
    name: str
    description: str = ""
    load_state: str = "unknown"          # loaded / not-found / masked
    active_state: str = "unknown"        # active / inactive / failed / activating
    sub_state: str = "unknown"           # running / dead / exited / failed ...
    unit_file_state: str = "unknown"     # enabled / disabled / static / masked
    main_pid: int = 0
    active_enter_ts: str = ""            # systemd ISO timestamp, empty if never
    fragment_path: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "load_state": self.load_state,
            "active_state": self.active_state,
            "sub_state": self.sub_state,
            "unit_file_state": self.unit_file_state,
            "main_pid": self.main_pid,
            "active_enter_ts": self.active_enter_ts,
            "fragment_path": self.fragment_path,
        }


# ---------- internal helpers ----------

async def _run(*args: str, timeout: float = 10.0) -> tuple[int, str, str]:
    """Run a command, capture stdout/stderr, return (code, out, err)."""
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return 124, "", "timeout"
    return proc.returncode or 0, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")


def _parse_show(payload: str) -> dict[str, str]:
    """Parse the KEY=VALUE output of ``systemctl show``."""
    res: dict[str, str] = {}
    for line in payload.splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            res[k.strip()] = v.strip()
    return res


# ---------- public API ----------

def list_enabled_units() -> list[str]:
    """Return the curated unit names (basenames of symlinks in ENABLED_DIR)."""
    if not ENABLED_DIR.exists():
        return []
    units: list[str] = []
    for entry in sorted(ENABLED_DIR.iterdir()):
        # Accept regular files and symlinks alike; reject anything that isn't a
        # plausible unit name.
        name = entry.name
        if is_valid_unit(name):
            units.append(name)
    return units


async def list_all_units() -> list[str]:
    """All loaded service units known to systemd.

    We exclude templates (names ending in ``@``) because they aren't
    instantiable on their own.
    """
    code, out, err = await _run(
        "systemctl", "list-unit-files",
        "--type=service", "--no-legend", "--no-pager", "--plain",
    )
    if code != 0:
        return []
    names: list[str] = []
    for line in out.splitlines():
        parts = line.split()
        if not parts:
            continue
        name = parts[0]
        if name.endswith("@.service"):
            continue
        if is_valid_unit(name):
            names.append(name)
    return names


async def get_status(name: str) -> ServiceStatus:
    if not is_valid_unit(name):
        raise ValueError(f"invalid unit name: {name!r}")
    props = (
        "Description", "LoadState", "ActiveState", "SubState",
        "UnitFileState", "MainPID", "ActiveEnterTimestamp", "FragmentPath",
    )
    code, out, _err = await _run(
        "systemctl", "show", name,
        "--no-pager", "--property=" + ",".join(props),
    )
    data = _parse_show(out) if code == 0 else {}
    return ServiceStatus(
        name=name,
        description=data.get("Description", ""),
        load_state=data.get("LoadState", "unknown"),
        active_state=data.get("ActiveState", "unknown"),
        sub_state=data.get("SubState", "unknown"),
        unit_file_state=data.get("UnitFileState", "unknown"),
        main_pid=int(data.get("MainPID", "0") or 0),
        active_enter_ts=data.get("ActiveEnterTimestamp", ""),
        fragment_path=data.get("FragmentPath", ""),
    )


async def get_statuses(names: Iterable[str]) -> list[ServiceStatus]:
    coros = [get_status(n) for n in names]
    return await asyncio.gather(*coros)


async def control(name: str, action: str) -> tuple[bool, str]:
    """Run ``sudo systemctl <action> <name>``.  Returns (ok, message)."""
    if not is_valid_unit(name):
        return False, f"invalid unit name"
    if action not in _ALLOWED_ACTIONS:
        return False, f"action not allowed"
    code, out, err = await _run("sudo", "-n", "systemctl", action, name, timeout=15.0)
    if code == 0:
        return True, out.strip() or "ok"
    return False, (err or out or "failed").strip()


async def logs_history(name: str, lines: int = 200) -> list[str]:
    """Recent log lines from journalctl, oldest-first."""
    if not is_valid_unit(name):
        raise ValueError("invalid unit name")
    lines = max(1, min(int(lines), 5000))
    code, out, _err = await _run(
        "journalctl", "-u", name,
        "-n", str(lines), "--no-pager", "--output=short-iso",
        timeout=15.0,
    )
    if code != 0:
        return []
    return out.splitlines()


async def tail_logs(name: str) -> AsyncIterator[str]:
    """Async generator yielding new journalctl lines forever.

    Caller must close the generator (``aclose``) to terminate the underlying
    journalctl process.
    """
    if not is_valid_unit(name):
        raise ValueError("invalid unit name")
    proc = await asyncio.create_subprocess_exec(
        "journalctl", "-u", name, "-f", "-n", "0", "--output=short-iso",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    assert proc.stdout is not None
    try:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            yield line.decode("utf-8", "replace").rstrip("\n")
    finally:
        if proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
