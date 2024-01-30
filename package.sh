#!/bin/bash

cp manifest-ff.json manifest.json
zip ext.xpi * icons/* -x package.sh ext.xpi
