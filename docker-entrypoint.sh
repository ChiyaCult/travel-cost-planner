#!/bin/sh
# /data ist ein Bind-Mount vom Host und gehört dort meist root oder dem
# Host-User. Einmal als root die Rechte richten, dann als deno starten.
set -e
chown -R deno:deno /data
exec setpriv --reuid=deno --regid=deno --init-groups "$@"
