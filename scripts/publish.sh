#!/bin/bash
set -e

version=$(echo "$1" | cut -c2-10)

npm publish --tag $version
