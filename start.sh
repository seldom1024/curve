#!/bin/bash
## nodejs env
wget https://nodejs.org/dist/v10.16.0/node-v10.16.0-linux-x64.tar.xz
tar xf node-v10.16.0-linux-x64.tar.xz -C /opt/

## virtualenv install
pip install --upgrade pip
pip install virtualenv
pip install virtualenv==16.7.9
source /etc/profile

## start
/Curve/control.sh start
while true; do echo hello world; sleep 10000000000000000000000000; done
