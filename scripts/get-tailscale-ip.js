#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  const output = execSync('tailscale ip -4', { encoding: 'utf8' });
  console.log(output.trim());
} catch (e) {
  console.log('Tailscale not connected. Run "tailscale up" first.');
  process.exit(1);
}