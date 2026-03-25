#!/usr/bin/env python3
import os
import queue
import shlex
import subprocess
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, scrolledtext


REPO_ROOT = Path(__file__).resolve().parent
LOCAL_BACKEND_ENV = REPO_ROOT / "stormcloud" / ".env"
LOCAL_FRONTEND_ENV = REPO_ROOT / "stormwatch" / ".env"
LOCAL_BACKEND_DIR = REPO_ROOT / "stormcloud"
LOCAL_FRONTEND_DIR = REPO_ROOT / "stormwatch"

DEFAULT_SERVICE = "stormcloud"
DEFAULT_SITE_URL = "https://redstormcloud.com"
DEFAULT_REPO_PATH = "/home/stormcloud/StormCloud"
DEFAULT_USER = "stormcloud"
DEFAULT_LOCAL_HEALTH_URL = "http://127.0.0.1:8080/api/health"
PLINK_PATH = r"C:\Program Files\PuTTY\plink.exe"
PSCP_PATH = r"C:\Program Files\PuTTY\pscp.exe"
EXCLUDED_DIR_NAMES = {".git", ".expo", "__pycache__", "node_modules", "dist"}
EXCLUDED_FILE_SUFFIXES = {".pyc"}
EXCLUDED_FILE_NAMES = {"Thumbs.db", ".DS_Store"}


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def write_env_value(path: Path, key: str, value: str) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    updated: list[str] = []
    found = False
    for raw_line in lines:
        stripped = raw_line.strip()
        if stripped.startswith("#") or "=" not in raw_line:
            updated.append(raw_line)
            continue
        current_key, _ = raw_line.split("=", 1)
        if current_key.strip() == key:
            updated.append(f"{key}={value}")
            found = True
        else:
            updated.append(raw_line)
    if not found:
        updated.append(f"{key}={value}")
    path.write_text("\n".join(updated) + "\n", encoding="utf-8")


class CommandRunner:
    def __init__(self) -> None:
        self.queue: queue.Queue[tuple[str, str]] = queue.Queue()

    def run_async(self, title: str, command: list[str], cwd: Path | None = None) -> None:
        thread = threading.Thread(target=self._run_command, args=(title, command, cwd), daemon=True)
        thread.start()

    def _run_command(self, title: str, command: list[str], cwd: Path | None = None) -> None:
        self.queue.put(("log", f"$ {' '.join(shlex.quote(part) for part in command)}\n"))
        try:
            completed = subprocess.run(
                command,
                cwd=str(cwd) if cwd else None,
                capture_output=True,
                text=True,
                check=False,
            )
        except Exception as exc:
            self.queue.put(("log", f"{title} error: {exc}\n"))
            self.queue.put(("status", f"{title}: failed"))
            return

        if completed.stdout:
            self.queue.put(("log", completed.stdout.rstrip() + "\n"))
        if completed.stderr:
            self.queue.put(("log", completed.stderr.rstrip() + "\n"))

        if completed.returncode == 0:
            self.queue.put(("status", f"{title}: complete"))
        else:
            self.queue.put(("status", f"{title}: failed ({completed.returncode})"))


class ControlPanel(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("StormCloud Deployment Control Panel")
        self.geometry("1240x820")
        self.minsize(1080, 720)

        self.runner = CommandRunner()

        self.pi_host = tk.StringVar(value="")
        self.pi_user = tk.StringVar(value=DEFAULT_USER)
        self.ssh_password = tk.StringVar(value="")
        self.sudo_password = tk.StringVar(value="")
        self.repo_path = tk.StringVar(value=DEFAULT_REPO_PATH)
        self.service_name = tk.StringVar(value=DEFAULT_SERVICE)
        self.site_url = tk.StringVar(value=DEFAULT_SITE_URL)

        self.mode_var = tk.StringVar(value="unknown")
        self.backend_mode_var = tk.StringVar(value="unknown")
        self.frontend_mode_var = tk.StringVar(value="unknown")
        self.service_status_var = tk.StringVar(value="Unknown")
        self.health_local_var = tk.StringVar(value="Unknown")
        self.health_public_var = tk.StringVar(value="Unknown")
        self.last_action_var = tk.StringVar(value="Ready")
        self.pi_connection_var = tk.StringVar(value="Unknown")
        self.refreshing = False

        self._build_ui()
        self._poll_queue()
        self.refresh_snapshot_async()

    def _build_ui(self) -> None:
        root = tk.Frame(self, padx=14, pady=14)
        root.pack(fill="both", expand=True)

        top = tk.Frame(root)
        top.pack(fill="x", pady=(0, 12))

        target_frame = tk.LabelFrame(top, text="Target Pi", padx=10, pady=10)
        target_frame.pack(side="top", fill="x", pady=(0, 10))

        rows = [
            ("Pi IP / Host", self.pi_host, 0, 0),
            ("SSH User", self.pi_user, 0, 2),
            ("SSH Password", self.ssh_password, 1, 0),
            ("Sudo Password", self.sudo_password, 1, 2),
            ("Repo Path", self.repo_path, 2, 0),
            ("Service", self.service_name, 2, 2),
            ("Public URL", self.site_url, 3, 0),
        ]
        for label, variable, row, column in rows:
            tk.Label(target_frame, text=label).grid(row=row, column=column, sticky="w", pady=4)
            width = 28 if label != "Repo Path" else 42
            entry = tk.Entry(target_frame, textvariable=variable, width=width)
            if "Password" in label:
                entry.configure(show="*")
            entry.grid(row=row, column=column + 1, sticky="ew", padx=(8, 18), pady=4)

        tk.Button(target_frame, text="Refresh Status", width=16, command=self.refresh_snapshot_async).grid(row=3, column=4, padx=(8, 0), sticky="e")

        status_controls = tk.Frame(top)
        status_controls.pack(fill="both", expand=True)

        status_frame = tk.LabelFrame(status_controls, text="Current State", padx=10, pady=10)
        status_frame.pack(side="left", fill="both", expand=True, padx=(0, 8))

        indicator_row = tk.Frame(status_frame)
        indicator_row.grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 8))
        tk.Label(indicator_row, text="Pi Connection:", anchor="w", width=28).pack(side="left")
        self.connection_light = tk.Canvas(indicator_row, width=16, height=16, highlightthickness=0, bd=0)
        self.connection_light.pack(side="left", padx=(0, 8))
        self.connection_light_oval = self.connection_light.create_oval(2, 2, 14, 14, fill="#6b7280", outline="")
        tk.Label(indicator_row, textvariable=self.pi_connection_var, anchor="w").pack(side="left")

        for index, (label, variable) in enumerate(
            [
                ("Overall Mode", self.mode_var),
                ("Backend APP_ENV", self.backend_mode_var),
                ("Frontend EXPO_PUBLIC_APP_ENV", self.frontend_mode_var),
                ("Service Status", self.service_status_var),
                ("Pi Local API Health", self.health_local_var),
                ("Public API Health", self.health_public_var),
                ("Last Action", self.last_action_var),
            ]
        ):
            row = index + 1
            tk.Label(status_frame, text=label + ":", anchor="w", width=28).grid(row=row, column=0, sticky="w", pady=2)
            tk.Label(status_frame, textvariable=variable, anchor="w").grid(row=row, column=1, sticky="w", pady=2)

        button_frame = tk.LabelFrame(status_controls, text="Controls", padx=10, pady=10)
        button_frame.pack(side="right", fill="y")

        buttons = [
            ("Copy Directory", self.copy_directory),
            ("Restart Backend", self.restart_backend),
            ("Rebuild Frontend", self.rebuild_frontend),
            ("Full Deploy", self.full_deploy),
            ("Set Development Mode", lambda: self.set_mode("development")),
            ("Set Production Mode", lambda: self.set_mode("production")),
        ]
        for row, (label, callback) in enumerate(buttons):
            tk.Button(button_frame, text=label, width=24, command=callback).grid(row=row, column=0, pady=4, sticky="ew")

        log_frame = tk.LabelFrame(root, text="Logs", padx=10, pady=10)
        log_frame.pack(fill="both", expand=True)

        self.log_text = scrolledtext.ScrolledText(log_frame, wrap="word", font=("Consolas", 10))
        self.log_text.pack(fill="both", expand=True)

    def _poll_queue(self) -> None:
        while True:
            try:
                kind, payload = self.runner.queue.get_nowait()
            except queue.Empty:
                break
            if kind == "log":
                self.log_text.insert("end", payload)
                self.log_text.see("end")
            elif kind == "status":
                self.last_action_var.set(payload)
                if payload.endswith("complete"):
                    self.refresh_snapshot_async()
            elif kind == "snapshot":
                self._apply_snapshot(payload)
        self.after(200, self._poll_queue)

    def _sudo_prefix(self) -> list[str]:
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            return []
        return ["sudo"]

    def _use_remote(self) -> bool:
        return bool(self.pi_host.get().strip())

    def _ssh_target(self) -> str:
        user = self.pi_user.get().strip() or DEFAULT_USER
        host = self.pi_host.get().strip()
        return f"{user}@{host}"

    def _remote_backend_env(self) -> str:
        return f"{self.repo_path.get().rstrip('/')}/stormcloud/.env"

    def _remote_frontend_env(self) -> str:
        return f"{self.repo_path.get().rstrip('/')}/stormwatch/.env"

    def _run_capture(self, command: list[str], cwd: Path | None = None) -> tuple[bool, str]:
        try:
            completed = subprocess.run(
                command,
                cwd=str(cwd) if cwd else None,
                capture_output=True,
                text=True,
                check=False,
            )
            output = (completed.stdout or completed.stderr or "").strip()
            return completed.returncode == 0, output
        except Exception as exc:
            return False, str(exc)

    def _remote_command(self, shell_command: str) -> list[str]:
        password = self.ssh_password.get()
        if password and Path(PLINK_PATH).exists():
            command = [
                PLINK_PATH,
                "-batch",
                "-ssh",
            ]
            command.extend([
                "-pw",
                password,
                self._ssh_target(),
                f"bash -lc {shlex.quote(shell_command)}",
            ])
            return command
        command = [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=5",
        ]
        command.extend([
            self._ssh_target(),
            "bash",
            "-lc",
            shell_command,
        ])
        return command

    def _ssh_command(self, batch_mode: bool = True) -> list[str]:
        command = ["ssh", "-o", f"BatchMode={'yes' if batch_mode else 'no'}", "-o", "ConnectTimeout=5"]
        command.append(self._ssh_target())
        return command

    def _remote_capture(self, shell_command: str) -> tuple[bool, str]:
        return self._run_capture(self._remote_command(shell_command))

    def _sudo_wrap(self, command: str) -> str:
        sudo_password = self.sudo_password.get()
        if sudo_password:
            escaped = sudo_password.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$")
            return f'printf "%s\\n" "{escaped}" | sudo -S -p "" {command}'
        return f"sudo {command}"

    def _sync_repo_with_pscp(self) -> None:
        if not Path(PSCP_PATH).exists():
            raise RuntimeError("pscp.exe not found. Install PuTTY or add pscp.exe to this machine.")
        password = self.ssh_password.get().strip()
        if not password:
            raise RuntimeError("SSH password is required for full deploy on this Windows machine.")

        remote_repo = self.repo_path.get().rstrip("/")
        remote_parent = remote_repo.rsplit("/", 1)[0]
        prepare_title = "Prepare remote repo directory"
        self.runner._run_command(
            prepare_title,
            self._remote_command(f"rm -rf {shlex.quote(remote_repo)} && mkdir -p {shlex.quote(remote_parent)} {shlex.quote(remote_repo)}"),
        )

        file_paths: list[Path] = []
        dir_paths: set[str] = {""}
        for root, dirs, files in os.walk(REPO_ROOT):
            root_path = Path(root)
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIR_NAMES]
            rel_dir = root_path.relative_to(REPO_ROOT)
            dir_key = "" if str(rel_dir) == "." else rel_dir.as_posix()
            dir_paths.add(dir_key)

            for filename in files:
                if filename in EXCLUDED_FILE_NAMES:
                    continue
                file_path = root_path / filename
                if file_path.suffix in EXCLUDED_FILE_SUFFIXES:
                    continue
                file_paths.append(file_path)

        for rel_dir in sorted(dir_paths):
            if not rel_dir:
                continue
            remote_dir = f"{remote_repo}/{rel_dir}"
            self.runner._run_command(
                f"Create remote directory: {remote_dir}",
                self._remote_command(f"mkdir -p {shlex.quote(remote_dir)}"),
            )

        for file_path in sorted(file_paths):
            rel_path = file_path.relative_to(REPO_ROOT).as_posix()
            remote_file = f"{remote_repo}/{rel_path}"
            self.runner.queue.put(("log", f"Uploading: {rel_path}\n"))
            self.runner._run_command(
                f"Upload {rel_path}",
                [
                    PSCP_PATH,
                    "-batch",
                    "-pw",
                    password,
                    str(file_path),
                    f"{self._ssh_target()}:{remote_file}",
                ],
            )

    def _set_connection_light(self, connected: bool) -> None:
        color = "#16a34a" if connected else "#dc2626"
        self.connection_light.itemconfig(self.connection_light_oval, fill=color)
        self.pi_connection_var.set("Connected" if connected else "Disconnected")

    def refresh_snapshot_async(self) -> None:
        if self.refreshing:
            return
        self.refreshing = True
        self.last_action_var.set("Refreshing status...")
        threading.Thread(target=self._refresh_snapshot_worker, daemon=True).start()

    def _refresh_snapshot_worker(self) -> None:
        try:
            self.runner.queue.put(("log", "=== Refresh Status ===\n"))
            snapshot = self._collect_snapshot()
            self.runner.queue.put(("log", self._format_snapshot_log(snapshot)))
            self.runner.queue.put(("snapshot", snapshot))
        except Exception as exc:
            self.runner.queue.put(("log", f"Refresh error: {exc}\n"))
            self.runner.queue.put(("snapshot", {
                "mode": "unknown",
                "backend_mode": "unknown",
                "frontend_mode": "unknown",
                "service_status": "Unavailable",
                "health_local": "Unavailable",
                "health_public": "Unavailable",
                "connected": False,
                "last_action": f"Refresh failed: {exc}",
            }))

    def _format_snapshot_log(self, snapshot: dict[str, object]) -> str:
        lines = [
            f"Connected: {snapshot.get('connected', False)}",
            f"Overall Mode: {snapshot.get('mode', 'unknown')}",
            f"Backend APP_ENV: {snapshot.get('backend_mode', 'unknown')}",
            f"Frontend EXPO_PUBLIC_APP_ENV: {snapshot.get('frontend_mode', 'unknown')}",
            f"Service Status: {snapshot.get('service_status', 'Unavailable')}",
            f"Pi Local API Health: {snapshot.get('health_local', 'Unavailable')}",
            f"Public API Health: {snapshot.get('health_public', 'Unavailable')}",
            "",
        ]
        return "\n".join(lines)

    def _collect_snapshot(self) -> dict[str, object]:
        if self._use_remote():
            backend_env_path = shlex.quote(self._remote_backend_env())
            frontend_env_path = shlex.quote(self._remote_frontend_env())
            service = shlex.quote(self.service_name.get().strip() or DEFAULT_SERVICE)

            ssh_ok, _ = self._remote_capture("echo connected")
            ok, backend_mode = self._remote_capture(f"grep '^APP_ENV=' {backend_env_path} | tail -n 1 | cut -d= -f2-")
            backend_mode_value = backend_mode if ok and backend_mode else "unknown"

            ok, frontend_mode = self._remote_capture(f"grep '^EXPO_PUBLIC_APP_ENV=' {frontend_env_path} | tail -n 1 | cut -d= -f2-")
            frontend_mode_value = frontend_mode if ok and frontend_mode else "unknown"

            if backend_mode_value == frontend_mode_value and backend_mode_value != "unknown":
                mode_value = backend_mode_value
            else:
                mode_value = f"split ({backend_mode_value}/{frontend_mode_value})"

            ok, service_status = self._remote_capture(self._sudo_wrap(f"systemctl is-active {service}"))
            service_status_value = service_status if ok and service_status else "Unavailable"

            ok, local_health = self._remote_capture(f"curl -sS {shlex.quote(DEFAULT_LOCAL_HEALTH_URL)}")
            health_local_value = local_health if ok and local_health else "Unavailable"

            public_url = self.site_url.get().strip() or DEFAULT_SITE_URL
            ok, public_health = self._run_capture(["curl", "-sS", f"{public_url}/api/health"])
            health_public_value = public_health if ok and public_health else "Unavailable"

            return {
                "mode": mode_value,
                "backend_mode": backend_mode_value,
                "frontend_mode": frontend_mode_value,
                "service_status": service_status_value,
                "health_local": health_local_value,
                "health_public": health_public_value,
                "connected": ssh_ok,
                "last_action": "Status refreshed",
            }

        backend_env = read_env_file(LOCAL_BACKEND_ENV)
        frontend_env = read_env_file(LOCAL_FRONTEND_ENV)
        backend_mode = backend_env.get("APP_ENV", "development")
        frontend_mode = frontend_env.get("EXPO_PUBLIC_APP_ENV", "development")
        mode_value = backend_mode if backend_mode == frontend_mode else f"split ({backend_mode}/{frontend_mode})"

        ok, service_status = self._run_capture(self._sudo_prefix() + ["systemctl", "is-active", self.service_name.get().strip() or DEFAULT_SERVICE])
        service_status_value = service_status if ok and service_status else "Unavailable"

        ok, local_health = self._run_capture(["curl", "-sS", DEFAULT_LOCAL_HEALTH_URL])
        health_local_value = local_health if ok and local_health else "Unavailable"

        public_url = self.site_url.get().strip() or DEFAULT_SITE_URL
        ok, public_health = self._run_capture(["curl", "-sS", f"{public_url}/api/health"])
        health_public_value = public_health if ok and public_health else "Unavailable"

        return {
            "mode": mode_value,
            "backend_mode": backend_mode,
            "frontend_mode": frontend_mode,
            "service_status": service_status_value,
            "health_local": health_local_value,
            "health_public": health_public_value,
            "connected": LOCAL_BACKEND_ENV.exists() and LOCAL_FRONTEND_ENV.exists(),
            "last_action": "Status refreshed",
        }

    def _apply_snapshot(self, snapshot: dict[str, object]) -> None:
        self.mode_var.set(str(snapshot.get("mode", "unknown")))
        self.backend_mode_var.set(str(snapshot.get("backend_mode", "unknown")))
        self.frontend_mode_var.set(str(snapshot.get("frontend_mode", "unknown")))
        self.service_status_var.set(str(snapshot.get("service_status", "Unavailable")))
        self.health_local_var.set(str(snapshot.get("health_local", "Unavailable")))
        self.health_public_var.set(str(snapshot.get("health_public", "Unavailable")))
        self.last_action_var.set(str(snapshot.get("last_action", "Ready")))
        self._set_connection_light(bool(snapshot.get("connected", False)))
        self.refreshing = False

    def show_logs(self) -> None:
        service = self.service_name.get().strip() or DEFAULT_SERVICE
        self.last_action_var.set("Loading logs...")
        if self._use_remote():
            self.runner.run_async("Logs", self._remote_command(self._sudo_wrap(f"journalctl -u {shlex.quote(service)} -n 200 --no-pager")))
            return
        self.runner.run_async("Logs", self._sudo_prefix() + ["journalctl", "-u", service, "-n", "200", "--no-pager"])

    def copy_directory(self) -> None:
        self.last_action_var.set("Copying local directory to target...")
        if self._use_remote():
            def worker() -> None:
                try:
                    self._sync_repo_with_pscp()
                except Exception as exc:
                    self.runner.queue.put(("log", f"Copy directory error: {exc}\n"))
                    self.runner.queue.put(("status", "Copy directory: failed"))

            threading.Thread(target=worker, daemon=True).start()
            return
        self.runner.queue.put(("log", "Copy directory is only needed in remote mode.\n"))
        self.runner.queue.put(("status", "Copy directory: skipped"))

    def restart_backend(self) -> None:
        service = self.service_name.get().strip() or DEFAULT_SERVICE
        self.last_action_var.set("Restarting backend...")
        if self._use_remote():
            self.runner.run_async("Restart backend", self._remote_command(self._sudo_wrap(f"systemctl restart {shlex.quote(service)}")))
            return
        self.runner.run_async("Restart backend", self._sudo_prefix() + ["systemctl", "restart", service], LOCAL_BACKEND_DIR)

    def rebuild_frontend(self) -> None:
        self.last_action_var.set("Rebuilding frontend...")
        if self._use_remote():
            repo = shlex.quote(self.repo_path.get().rstrip("/"))
            command = (
                f"cd {repo}/stormwatch && "
                f"npx expo export --platform web && "
                f"{self._sudo_wrap('caddy validate --config /etc/caddy/Caddyfile')} && "
                f"{self._sudo_wrap('caddy reload --config /etc/caddy/Caddyfile')}"
            )
            self.runner.run_async("Rebuild frontend", self._remote_command(command))
            return

        def worker() -> None:
            commands = [
                ("Export frontend", ["npx", "expo", "export", "--platform", "web"], LOCAL_FRONTEND_DIR),
                ("Validate caddy", self._sudo_prefix() + ["caddy", "validate", "--config", "/etc/caddy/Caddyfile"], None),
                ("Reload caddy", self._sudo_prefix() + ["caddy", "reload", "--config", "/etc/caddy/Caddyfile"], None),
            ]
            for title, command, cwd in commands:
                self.runner._run_command(title, command, cwd)

        threading.Thread(target=worker, daemon=True).start()

    def full_deploy(self) -> None:
        self.last_action_var.set("Running full deploy...")
        if self._use_remote():
            repo = shlex.quote(self.repo_path.get().rstrip("/"))

            def worker() -> None:
                try:
                    self._sync_repo_with_pscp()
                except Exception as exc:
                    self.runner.queue.put(("log", f"Sync local repo to Pi error: {exc}\n"))
                    self.runner.queue.put(("status", "Sync local repo to Pi: failed"))
                    return
                self.runner._run_command(
                    "Run remote full deploy",
                    self._remote_command(f"cd {repo} && {self._sudo_wrap('./full.sh')}"),
                )

            threading.Thread(target=worker, daemon=True).start()
            return
        self.runner.run_async("Full deploy", ["bash", "./full.sh"], REPO_ROOT)

    def set_mode(self, mode: str) -> None:
        if mode not in {"development", "production"}:
            return

        if self._use_remote():
            backend_env = shlex.quote(self._remote_backend_env())
            frontend_env = shlex.quote(self._remote_frontend_env())
            backend_cmd = (
                f"if grep -q '^APP_ENV=' {backend_env}; then "
                f"sed -i 's/^APP_ENV=.*/APP_ENV={mode}/' {backend_env}; "
                f"else printf '\\nAPP_ENV={mode}\\n' >> {backend_env}; fi"
            )
            frontend_cmd = (
                f"if grep -q '^EXPO_PUBLIC_APP_ENV=' {frontend_env}; then "
                f"sed -i 's/^EXPO_PUBLIC_APP_ENV=.*/EXPO_PUBLIC_APP_ENV={mode}/' {frontend_env}; "
                f"else printf '\\nEXPO_PUBLIC_APP_ENV={mode}\\n' >> {frontend_env}; fi"
            )
            self.runner.run_async("Set mode", self._remote_command(f"{backend_cmd} && {frontend_cmd}"))
            if messagebox.askyesno("Apply mode change", "Restart backend and rebuild frontend now?"):
                self.restart_backend()
                self.rebuild_frontend()
            return

        write_env_value(LOCAL_BACKEND_ENV, "APP_ENV", mode)
        write_env_value(LOCAL_FRONTEND_ENV, "EXPO_PUBLIC_APP_ENV", mode)
        self.last_action_var.set(f"Mode set to {mode}. Restart/rebuild to apply.")
        self.log_text.insert("end", f"Updated {LOCAL_BACKEND_ENV} APP_ENV={mode}\n")
        self.log_text.insert("end", f"Updated {LOCAL_FRONTEND_ENV} EXPO_PUBLIC_APP_ENV={mode}\n")
        self.log_text.see("end")
        self.refresh_snapshot_async()
        if messagebox.askyesno("Apply mode change", "Restart backend and rebuild frontend now?"):
            self.restart_backend()
            self.rebuild_frontend()


if __name__ == "__main__":
    app = ControlPanel()
    app.mainloop()
