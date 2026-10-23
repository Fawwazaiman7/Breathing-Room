# Ruang Pulih: download the calm piano recordings so the app serves them itself.
#
# The music is real piano recordings of Chopin made by the Musopen project and
# released into the public domain (CC0 1.0): https://archive.org/details/musopen-chopin
# Without these files the app still works: it streams the same recordings from
# the Internet Archive. With them, the music loads faster and does not depend on it.
#
# Run from the frontend folder:  powershell -ExecutionPolicy Bypass -File scripts/download-music.ps1

$ErrorActionPreference = 'Stop'
$base = 'https://archive.org/download/musopen-chopin/'
$tracks = [ordered]@{
  'chopin-nocturne-op9-no2.mp3'  = 'Nocturne%20Op.%209%20no.%202%20in%20E%20flat%20major.mp3'
  'chopin-nocturne-op32-no1.mp3' = 'Nocturne%20Op.%2032%20no.%201%20in%20B%20major.mp3'
  'chopin-prelude-op28-no15.mp3' = 'Prelude%20Op.%2028%20no.%2015.mp3'
  'chopin-prelude-op28-no13.mp3' = 'Prelude%20Op.%2028%20no.%2013.mp3'
  'chopin-prelude-op28-no17.mp3' = 'Prelude%20Op.%2028%20no.%2017.mp3'
  'chopin-nocturne-op27-no2.mp3' = 'NocturneOp27No2.mp3'
  'chopin-nocturne-op62-no2.mp3' = 'Nocturne%20Op.%2062%20no.%202%20in%20E%20major.mp3'
}
$dir = Join-Path $PSScriptRoot '..\public\audio'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
foreach ($name in $tracks.Keys) {
  $target = Join-Path $dir $name
  if (Test-Path $target) { Write-Host "Already here: $name"; continue }
  Write-Host "Downloading $name ..."
  Invoke-WebRequest -Uri ($base + $tracks[$name]) -OutFile $target
}
Write-Host 'Done. Commit frontend/public/audio and deploy.'
