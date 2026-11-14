#!/bin/sh
missing=""
for tool in "$@"; do
	command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
done
if [ -n "$missing" ]; then
	echo "Missing:$missing. Install with: brew install$missing" >&2
	exit 1
fi
