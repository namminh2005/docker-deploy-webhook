#!/bin/bash
if [ -f "/usr/src/app/conf/config.json" ]; then
echo "File config exits File exists"
else
echo "Copy default cofig"
cp "/usr/src/app/default-conf.json" "/usr/src/app/conf/config.json"
fi