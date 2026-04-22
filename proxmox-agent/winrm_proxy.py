#!/usr/bin/env python3
"""
WinRM Proxy Agent — runs on Proxmox host.
Receives { ip, command } from backend and executes PowerShell via WinRM.
Proxmox can reach 10.10.10.x directly, so this acts as a bridge.
"""

import os
import winrm
from flask import Flask, request, jsonify

app = Flask(__name__)

PROXY_PORT    = int(os.environ.get('PROXY_PORT', 8007))
PROXY_SECRET  = os.environ.get('PROXY_SECRET', 'changeme')
WINRM_USER    = os.environ.get('WINRM_USERNAME', 'Administrator')
WINRM_PASS    = os.environ.get('WINRM_PASSWORD', '')
WINRM_PORT    = int(os.environ.get('WINRM_PORT', 5985))


@app.before_request
def check_auth():
    secret = request.headers.get('X-Proxy-Secret')
    if secret != PROXY_SECRET:
        return jsonify({'error': 'Unauthorized'}), 401


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/execute', methods=['POST'])
def execute():
    data = request.get_json()
    ip      = data.get('ip')
    command = data.get('command')

    if not ip or not command:
        return jsonify({'error': 'ip and command are required'}), 400

    try:
        session = winrm.Session(
            f'http://{ip}:{WINRM_PORT}/wsman',
            auth=(WINRM_USER, WINRM_PASS),
            transport='basic',
            server_cert_validation='ignore',
        )
        result = session.run_ps(command)
        return jsonify({
            'stdout': result.std_out.decode('utf-8', errors='replace').strip(),
            'stderr': result.std_err.decode('utf-8', errors='replace').strip(),
            'exit_code': result.status_code,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print(f'[WinRM Proxy] Starting on port {PROXY_PORT}')
    app.run(host='127.0.0.1', port=PROXY_PORT)
