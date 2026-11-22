#!/bin/sh
set -eu
umask 077
ip=$1
out=".howmuch/tls"
mkdir -p "$out"
if [ ! -e "$out/ca.key" ]; then
 openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 30 -subj '/CN=HowMuch Local Demo CA' -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' -addext 'keyUsage=critical,keyCertSign,cRLSign' -keyout "$out/ca.key" -out "$out/ca.crt"
fi
if ! openssl x509 -in "$out/$ip.pem" -noout -checkend 600 >/dev/null 2>&1; then
 openssl req -newkey rsa:2048 -nodes -subj "/CN=$ip" -keyout "$out/$ip.key" -out "$out/$ip.csr"
 printf 'subjectAltName=IP:%s,DNS:localhost\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\n' "$ip" > "$out/$ip.ext"
 openssl x509 -req -in "$out/$ip.csr" -CA "$out/ca.crt" -CAkey "$out/ca.key" -CAcreateserial -out "$out/$ip.pem" -days 7 -sha256 -extfile "$out/$ip.ext"
fi
openssl x509 -in "$out/ca.crt" -noout -fingerprint -sha256
