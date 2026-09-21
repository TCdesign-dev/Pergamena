#!/bin/sh
# Compila pergamena-ascolto. Il Info.plist va cucito dentro al binario:
# senza, macOS non sa per quale motivo un programma da riga di comando
# chiede il microfono, e la richiesta di permesso non compare.
set -e
cd "$(dirname "$0")"
mkdir -p ../../build
swiftc -O -swift-version 5 -parse-as-library \
  -target arm64-apple-macosx26.0 \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker Info.plist \
  main.swift -o ../../build/pergamena-ascolto
echo "✓ build/pergamena-ascolto"
