#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Instalando por primera vez, un momento..."
  npm install
fi
echo ""
echo "Iniciando el cotizador..."
echo "No cierre esta ventana mientras la esten usando."
echo ""
node server.js
