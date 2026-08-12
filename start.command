#!/bin/bash
cd "$(dirname "$0")"
python3 -m http.server 5500 &
sleep 1
open "http://localhost:5500"
wait
