#!/bin/bash
# Kali Tunnel Setup — creates SSH tunnels between local Kali, cat62, and VPS
# Run from WSL Kali: wsl -d kali-linux -- bash /mnt/d/Projects/mana-dashboard/scripts/kali-tunnel-setup.sh

VPS="root@141.136.47.94"
MANA_PORT=3003
OLLAMA_PORT=11434

echo "=== Kali Commander Tunnel Setup ==="
echo "VPS: $VPS"
echo ""

# Check SSH to VPS
echo "[1/5] Testing VPS connection..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes $VPS "echo ok" 2>/dev/null; then
  echo "  VPS SSH: OK"
else
  echo "  VPS SSH: FAILED — push your key first:"
  echo "  ssh-copy-id $VPS"
  echo ""
  echo "  Or use your hosting panel to add this key:"
  cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub 2>/dev/null || echo "  (no key found — run ssh-keygen first)"
  echo ""
fi

# Check Tailscale for cat62
echo "[2/5] Checking Tailscale for cat62..."
CAT62_IP=$(tailscale status 2>/dev/null | grep -i cat62 | awk '{print $1}')
if [ -n "$CAT62_IP" ]; then
  echo "  cat62 found at: $CAT62_IP"
else
  echo "  cat62 not found (Tailscale may be logged out)"
  CAT62_IP=""
fi

# Tunnel 1: Forward Mana Dashboard to VPS
echo "[3/5] Tunnel: Local Mana Dashboard -> VPS:$MANA_PORT"
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -f -N \
  -R ${MANA_PORT}:127.0.0.1:${MANA_PORT} $VPS 2>/dev/null && \
  echo "  Reverse tunnel open: VPS:$MANA_PORT -> local:$MANA_PORT" || \
  echo "  Failed (VPS SSH not available)"

# Tunnel 2: Forward local Ollama to VPS
echo "[4/5] Tunnel: Local Ollama -> VPS:$OLLAMA_PORT"
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -f -N \
  -R ${OLLAMA_PORT}:127.0.0.1:${OLLAMA_PORT} $VPS 2>/dev/null && \
  echo "  Reverse tunnel open: VPS:$OLLAMA_PORT -> local Ollama:$OLLAMA_PORT" || \
  echo "  Failed (VPS SSH not available)"

# Tunnel 3: cat62 <-> VPS bridge (if cat62 found)
if [ -n "$CAT62_IP" ]; then
  echo "[5/5] Tunnel: cat62 -> VPS (bridge)"
  ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -f -N \
    -L 2222:$CAT62_IP:22 $VPS 2>/dev/null && \
    echo "  Forward tunnel open: local:2222 -> cat62:22 via VPS" || \
    echo "  Failed"
else
  echo "[5/5] Skipped cat62 bridge (not found)"
fi

echo ""
echo "=== Tunnel Status ==="
echo "Active SSH tunnels:"
ps aux | grep "ssh.*-[NfL]\|ssh.*-[NfR]" | grep -v grep || echo "  (none)"
echo ""
echo "=== Resource Split Plan ==="
echo "LOCAL (RTX 5080 GPU):"
echo "  - Heavy models: qwen3.5:35b, deepseek-coder-v2, mixtral-creative"
echo "  - Agents: lozgic, forge, main, hapai, creative"
echo ""
echo "VPS (CPU only):"
echo "  - Light models: llama3.1:8b, nous-hermes2"
echo "  - Agents: tina, security, netwatch, gateway-vps, sentinel, seo-scraper"
echo "  - Services: n8n, mana-dashboard (mirror)"
echo ""
echo "CAT62 (via Tailscale):"
echo "  - Agents: cat62-keeper, relay-mesh"
echo "  - Bridge: tunneled through VPS"
echo ""
echo "Done. Kali Commander standing by."
