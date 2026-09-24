const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = 'C:/Users/Grupo Hazul/.gemini/antigravity/brain/f118c13c-f4cd-4f0b-91a6-c20cef7fea91/.user_uploaded/media_1790271986450.jpg';
const PROJ_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(PROJ_ROOT, 'src/dashboard/public/assets');
const APP_DESKTOP_DIR = path.join(PROJ_ROOT, 'app-desktop');

const TARGET_PNG = path.join(ASSETS_DIR, 'logo.png');
const TARGET_ICO = path.join(ASSETS_DIR, 'logo.ico');
const TARGET_DESKTOP_ICO = path.join(APP_DESKTOP_DIR, 'icon.ico');

console.log('--- Atualizando Logo do Bot Grupo Hazul ---');
console.log('Imagem de origem:', SOURCE_IMAGE);

if (!fs.existsSync(SOURCE_IMAGE)) {
  console.error('Arquivo de imagem de origem não encontrado!');
  process.exit(1);
}

// Script PowerShell para processamento de imagem com System.Drawing de alta qualidade
const psScript = `
Add-Type -AssemblyName System.Drawing

$srcPath = "${SOURCE_IMAGE.replace(/\\/g, '/')}"
$outPng = "${TARGET_PNG.replace(/\\/g, '/')}"
$outIco = "${TARGET_ICO.replace(/\\/g, '/')}"
$outDesktopIco = "${TARGET_DESKTOP_ICO.replace(/\\/g, '/')}"

$srcBmp = [System.Drawing.Bitmap]::new($srcPath)

# Bounding box do círculo do logo
$srcX = 64
$srcY = 64
$srcW = 928
$srcH = 922
$dim = [Math]::Max($srcW, $srcH)

# 1. Gera PNG 512x512 transparente com corte circular perfeito
$targetSize = 512
$pngBmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($pngBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Caminho circular para antialiasing nas bordas
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$pad = 4
$circleDim = $targetSize - ($pad * 2)
$path.AddEllipse($pad, $pad, $circleDim, $circleDim)
$g.SetClip($path)

$destRect = New-Object System.Drawing.Rectangle($pad, $pad, $circleDim, $circleDim)
$srcRect = New-Object System.Drawing.Rectangle($srcX, $srcY, $srcW, $srcH)
$g.DrawImage($srcBmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.ResetClip()
$g.Dispose()

$pngBmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "PNG gerado com sucesso: $outPng"

# 2. Gera ícones em múltiplos tamanhos para criar o .ICO
$sizes = @(256, 128, 64, 48, 32, 16)
$pngDataList = @()

foreach ($sz in $sizes) {
  $szBmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gSz = [System.Drawing.Graphics]::FromImage($szBmp)
  $gSz.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gSz.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gSz.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gSz.Clear([System.Drawing.Color]::Transparent)
  $gSz.DrawImage($pngBmp, 0, 0, $sz, $sz)
  $gSz.Dispose()

  $ms = New-Object System.IO.MemoryStream
  $szBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes = $ms.ToArray()
  $ms.Dispose()
  $szBmp.Dispose()

  $pngDataList += ,@($sz, $pngBytes)
}

$pngBmp.Dispose()
$srcBmp.Dispose()

# Monta o arquivo .ICO conforme especificação de formato ICONDIR / ICONDIRENTRY com PNGs embutidos
$icoStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($icoStream)

# Header ICONDIR: idReserved (0), idType (1), idCount
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$pngDataList.Count)

$offset = 6 + (16 * $pngDataList.Count)

foreach ($entry in $pngDataList) {
  $sz = $entry[0]
  $bytes = $entry[1]
  $bWidth = if ($sz -ge 256) { [Byte]0 } else { [Byte]$sz }
  $bHeight = if ($sz -ge 256) { [Byte]0 } else { [Byte]$sz }

  $writer.Write($bWidth)
  $writer.Write($bHeight)
  $writer.Write([Byte]0) # Color count
  $writer.Write([Byte]0) # Reserved
  $writer.Write([UInt16]1) # Planes
  $writer.Write([UInt16]32) # BitCount
  $writer.Write([UInt32]$bytes.Length) # BytesInRes
  $writer.Write([UInt32]$offset) # ImageOffset
  $offset += $bytes.Length
}

foreach ($entry in $pngDataList) {
  $bytes = $entry[1]
  $writer.Write($bytes)
}

$icoBytes = $icoStream.ToArray()
$writer.Dispose()
$icoStream.Dispose()

[System.IO.File]::WriteAllBytes($outIco, $icoBytes)
[System.IO.File]::WriteAllBytes($outDesktopIco, $icoBytes)
Write-Host "ICO gerado com sucesso: $outIco e $outDesktopIco"
`;

fs.writeFileSync(path.join(PROJ_ROOT, 'temp_generate_logo.ps1'), psScript, 'utf8');

try {
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -File temp_generate_logo.ps1', {
    cwd: PROJ_ROOT,
    stdio: 'inherit',
  });
  console.log('Imagens geradas com sucesso!');
} finally {
  try { fs.unlinkSync(path.join(PROJ_ROOT, 'temp_generate_logo.ps1')); } catch (_) {}
}

// Atualiza atalhos da área de trabalho
console.log('\nAtualizando atalhos Windows...');
try {
  require('./create-app-shortcuts.js');
  console.log('✅ Atalhos atualizados com o novo ícone!');
} catch (e) {
  console.warn('Aviso ao atualizar atalhos:', e.message);
}

