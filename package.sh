#!/bin/bash

cp manifest-ff.json manifest.json
zip ext.xpi * -x package.sh ext.xpi
