# Instagram story gorsel ureticisi -- 1080x1920 PNG
# Kullanim:  powershell -ExecutionPolicy Bypass -File docs/instagram/build-story.ps1
# Metinler docs/instagram/story-spec.json icinde (UTF-8). Bu dosya bilerek ASCII'dir:
# Windows PowerShell 5.1, BOM'suz dosyalari ANSI okur ve Turkce karakterleri bozar.

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $root 'package.json'))) { $root = (Get-Location).Path }

$spec     = Get-Content (Join-Path $PSScriptRoot 'story-spec.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$outDir   = Join-Path $root $spec.output
$photoDir = Join-Path $root $spec.photoDir
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function C([int]$r,[int]$g,[int]$b) { [System.Drawing.Color]::FromArgb($r,$g,$b) }
$BLUE     = C 37 99 235
$NAVY     = C 15 22 38
$WHITE    = C 255 255 255
$INK      = C 15 22 38
$MUTED    = C 86 97 122
$ONNAVY   = C 152 164 186
$ACCENT_L = C 108 155 245

$W = [int]$spec.width; $H = [int]$spec.height; $M = 90
# Instagram story ust/alt arayuzu kapatir -- guvenli alan 280..1660
$FOOT_Y = 1560

function Font([single]$size, [string]$style) {
  $s = [System.Drawing.FontStyle]::Regular
  if ($style -eq 'bold') { $s = [System.Drawing.FontStyle]::Bold }
  $fam = 'Segoe UI'
  if ($style -eq 'semibold') { $fam = 'Segoe UI Semibold' }
  New-Object System.Drawing.Font($fam, $size, $s, [System.Drawing.GraphicsUnit]::Pixel)
}

$SF = [System.Drawing.StringFormat]::GenericTypographic
$SF.FormatFlags = $SF.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
function TextW($g, $s, $f) { return $g.MeasureString($s, $f, 10000, $SF).Width }

function Draw-Tracked($g, $s, $f, $brush, [single]$x, [single]$y, [single]$track) {
  $cx = $x
  foreach ($ch in $s.ToCharArray()) {
    $c = [string]$ch
    $g.DrawString($c, $f, $brush, $cx, $y, $SF)
    $cx += (TextW $g $c $f) + $track
  }
}

function Draw-Wrapped($g, $s, $f, $brush, [single]$x, [single]$y, [single]$maxW, [single]$lh) {
  $cy = $y
  foreach ($para in ($s -split "`n")) {
    $line = ''
    foreach ($word in ($para -split ' ')) {
      if ($line -eq '') { $cand = $word } else { $cand = "$line $word" }
      if ((TextW $g $cand $f) -le $maxW) { $line = $cand }
      else {
        if ($line -ne '') { $g.DrawString($line, $f, $brush, $x, $cy, $SF); $cy += $lh }
        $line = $word
      }
    }
    if ($line -ne '') { $g.DrawString($line, $f, $brush, $x, $cy, $SF); $cy += $lh }
  }
  return $cy
}

function Get-PhotoBg([string]$name) {
  $path = Join-Path $photoDir $name
  if (-not (Test-Path $path)) { return $WHITE }
  $img = New-Object System.Drawing.Bitmap($path)
  try {
    $px = $img.GetPixel(1, 1)
    if ($px.A -lt 250) { return $WHITE }
    if (($px.R + $px.G + $px.B) / 3 -lt 235) { return $WHITE }
    return (C $px.R $px.G $px.B)
  } finally { $img.Dispose() }
}

function Draw-Photo($g, [string]$name, [single]$bx, [single]$by, [single]$bw, [single]$bh) {
  $path = Join-Path $photoDir $name
  if (-not (Test-Path $path)) { Write-Warning "gorsel yok: $name"; return }
  $img = [System.Drawing.Image]::FromFile($path)
  try {
    $scale = [Math]::Min($bw / $img.Width, $bh / $img.Height)
    $dw = $img.Width * $scale; $dh = $img.Height * $scale
    $g.DrawImage($img, ($bx + ($bw - $dw) / 2), ($by + ($bh - $dh) / 2), $dw, $dh)
  } finally { $img.Dispose() }
}

function Draw-Footer($g, [bool]$dark) {
  $nameCol = $INK; $domCol = $MUTED
  if ($dark) { $nameCol = $WHITE; $domCol = $ACCENT_L }
  $fb = Font 34 'bold'; $fr = Font 32 'regular'
  $bn = New-Object System.Drawing.SolidBrush($nameCol)
  $bd = New-Object System.Drawing.SolidBrush($domCol)
  $wordmark = 'efem ileti' + [char]0x015F + 'im'
  $g.DrawString($wordmark, $fb, $bn, [single]$M, [single]$FOOT_Y, $SF)
  $dom = 'efemiletisim.com'
  $g.DrawString($dom, $fr, $bd, [single]($W - $M - (TextW $g $dom $fr)), [single]($FOOT_Y + 3), $SF)
  $bn.Dispose(); $bd.Dispose(); $fb.Dispose(); $fr.Dispose()
}

function New-Canvas($bg) {
  $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($bg)
  return @($bmp, $g)
}

# harf araligi verilmis metnin toplam genisligi (ortalamak icin)
function TrackedW($g, $s, $f, [single]$track) {
  $w = 0
  foreach ($ch in $s.ToCharArray()) { $w += (TextW $g ([string]$ch) $f) + $track }
  return $w - $track
}

function Render-Cover($brand) {
  $c = New-Canvas $NAVY; $bmp = $c[0]; $g = $c[1]

  # blok dikey olarak guvenli alanin (280..1660) ortasina yerlesir
  # 'EFEM ILETISIM' -> I-dotted (U+0130) ve S-cedilla (U+015E) ile
  $eyebrow = 'EFEM ' + [char]0x0130 + 'LET' + [char]0x0130 + [char]0x015E + [char]0x0130 + 'M'
  $fe = Font 30 'bold'
  $be = New-Object System.Drawing.SolidBrush($ACCENT_L)
  $ew = TrackedW $g $eyebrow $fe 7
  Draw-Tracked $g $eyebrow $fe $be ([single](($W - $ew) / 2)) ([single]770) 7
  $be.Dispose(); $fe.Dispose()

  $fh = Font 150 'bold'
  $bw = New-Object System.Drawing.SolidBrush($WHITE)
  $nw = TextW $g $brand.name $fh
  $g.DrawString($brand.name, $fh, $bw, [single](($W - $nw) / 2), [single]850, $SF)
  $bw.Dispose(); $fh.Dispose()

  $rw = 180
  $rb = New-Object System.Drawing.SolidBrush($BLUE)
  $g.FillRectangle($rb, [single](($W - $rw) / 2), [single]1060, [single]$rw, [single]7)
  $rb.Dispose()

  $fs = Font 40 'regular'
  $bs = New-Object System.Drawing.SolidBrush($ONNAVY)
  $sw = TextW $g $brand.tagline $fs
  $g.DrawString($brand.tagline, $fs, $bs, [single](($W - $sw) / 2), [single]1115, $SF)
  $bs.Dispose(); $fs.Dispose()

  Draw-Footer $g $true
  return @($bmp, $g)
}

function Render-Item($brand, $item) {
  $c = New-Canvas (Get-PhotoBg $item.photo); $bmp = $c[0]; $g = $c[1]

  $fe = Font 30 'bold'
  $be = New-Object System.Drawing.SolidBrush($BLUE)
  Draw-Tracked $g $brand.name $fe $be ([single]$M) ([single]300) 7
  $be.Dispose(); $fe.Dispose()

  Draw-Photo $g $item.photo 90 420 900 760

  $ft = Font 70 'bold'
  $bt = New-Object System.Drawing.SolidBrush($INK)
  $y = Draw-Wrapped $g $item.title $ft $bt ([single]$M) 1250 ([single]($W - 2*$M)) 80
  $bt.Dispose(); $ft.Dispose()

  $fs = Font 38 'regular'
  $bs = New-Object System.Drawing.SolidBrush($MUTED)
  Draw-Wrapped $g $item.sub $fs $bs ([single]$M) ([single]($y + 18)) ([single]($W - 2*$M)) 50 | Out-Null
  $bs.Dispose(); $fs.Dispose()

  $rb = New-Object System.Drawing.SolidBrush($BLUE)
  $g.FillRectangle($rb, [single]0, [single]($H - 14), [single]$W, [single]14)
  $rb.Dispose()

  Draw-Footer $g $false
  return @($bmp, $g)
}

$made = 0
foreach ($brand in $spec.brands) {
  $dir = Join-Path $outDir $brand.key
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

  $r = Render-Cover $brand
  $r[0].Save((Join-Path $dir ("{0}-00-kapak.png" -f $brand.key)), [System.Drawing.Imaging.ImageFormat]::Png)
  $r[1].Dispose(); $r[0].Dispose(); $made++

  $i = 1
  foreach ($item in $brand.items) {
    $r = Render-Item $brand $item
    $file = "{0}-{1:d2}.png" -f $brand.key, $i
    $r[0].Save((Join-Path $dir $file), [System.Drawing.Imaging.ImageFormat]::Png)
    $r[1].Dispose(); $r[0].Dispose(); $made++; $i++
  }
  Write-Output ("  {0}: 10 kare" -f $brand.name)
}
Write-Output "$made story karesi uretildi -> $outDir"
