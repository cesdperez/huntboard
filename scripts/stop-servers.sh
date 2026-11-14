#!/usr/bin/env bash
# Stops the dev and preview servers of the checkout this runs in, with every process they started.
# Usage: bash scripts/stop-servers.sh
set -uo pipefail

root=$(pwd -P)
# pnpm, the `sh -c` it runs a script with, and the node CLIs of wrangler, vite and Playwright.
server_command='(^|/|-c )(pnpm|wrangler|vite|playwright)(\.c?js)?( |/|$)'

cwd_of() {
	lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'
}

inside_root() {
	local cwd
	cwd=$(cwd_of "$1")
	[[ -n $cwd && "$cwd/" == "$root/"* ]]
}

# Climbs from the listener while the parent is still a server process of this checkout,
# so the user's shell and agents in the worktree are never reached.
server_tree_top() {
	local pid=$1 parent
	while parent=$(ps -o ppid= -p "$pid" | tr -d ' ') && [[ $parent -gt 1 ]] &&
		inside_root "$parent" && ps -o command= -p "$parent" | grep -Eq "$server_command"; do
		pid=$parent
	done
	echo "$pid"
}

descendants() {
	local child
	for child in $(ps -A -o pid=,ppid= | awk -v p="$1" '$2 == p { print $1 }'); do
		descendants "$child"
		echo "$child"
	done
}

targets=()
for port in $(node scripts/ports.ts --all); do
	for listener in $(lsof -ti "tcp:$port" -sTCP:LISTEN); do
		# HUNTBOARD_PORT or a hash clash can point at another checkout's server.
		inside_root "$listener" || continue
		top=$(server_tree_top "$listener")
		targets+=($(descendants "$top") "$top")
	done
done

[[ ${#targets[@]} -eq 0 ]] && exit 0
kill "${targets[@]}" 2>/dev/null
sleep 2
kill -9 "${targets[@]}" 2>/dev/null
exit 0
