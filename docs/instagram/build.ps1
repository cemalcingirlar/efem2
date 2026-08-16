# Instagram gorsel ureticisi -- 1080x1080 PNG
# Kullanim:  powershell -ExecutionPolicy Bypass -File docs/instagram/build.ps1
# Metinler docs/instagram/spec.json icinde (UTF-8). Bu dosya bilerek ASCII'dir:
# Windows PowerShell 5.1, BOM'suz dosyalari ANSI okur ve Turkce karakterleri bozar.

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $root 'package.json'))) { $root = (Get-Location).Path }

$spec = Get-Content (Join-Path $PSScriptRoot 'spec.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$outDir   = Join-Path $root $spec.output
$photoDir = Join-Path $root $spec.photoDir
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

# ---- marka paleti ----
function C([int]$r,[int]$g,[int]$b) { [System.Drawing.Color]::FromArgb($r,$g,$b) }
$BLUE     = C 37 99 235      # --primary
$BLUE_DK  = C 27 74 203
$NAVY     = C 15 22 38
$WHITE    = C 255 255 255
$INK      = C 15 22 38
$MUTED    = C 86 97 122
$ONBLUE   = C 214 226 252
$ONNAVY   = C 152 164 186
$ACCENT_L = C 108 155 245

$W = 1080; $H = 1080; $M = 90; $FOOT_Y = 962

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

# harf arasi bosluk (letter-spacing) -- System.Drawing desteklemez, karakter karakter cizilir
function Draw-Tracked($g, $s, $f, $brush, [single]$x, [single]$y, [single]$track) {
  $cx = $x
  foreach ($ch in $s.ToCharArray()) {
    $c = [string]$ch
    $g.DrawString($c, $f, $brush, $cx, $y, $SF)
    $cx += (TextW $g $c $f) + $track
  }
}

# satir kaydirma; \n saygi gorur. Son Y degerini dondurur.
function Draw-Wrapped($g, $s, $f, $brush, [single]$x, [single]$y, [single]$maxW, [single]$lh) {
  $cy = $y
  foreach ($para in ($s -split "`n")) {
    $line = ''
    foreach ($word in ($para -split ' ')) {
      if ($line -eq '') { $cand = $word } else { $cand = "$line $word" }
      if ((TextW $g $cand $f) -le $maxW) {
        $line = $cand
      } else {
        if ($line -ne '') { $g.DrawString($line, $f, $brush, $x, $cy, $SF); $cy += $lh }
        $line = $word
      }
    }
    if ($line -ne '') { $g.DrawString($line, $f, $brush, $x, $cy, $SF); $cy += $lh }
  }
  return $cy
}

function RoundRect([single]$x,[single]$y,[single]$w,[single]$h,[single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r*2, $r*2, 180, 90)
  $p.AddArc($x+$w-$r*2, $y, $r*2, $r*2, 270, 90)
  $p.AddArc($x+$w-$r*2, $y+$h-$r*2, $r*2, $r*2, 0, 90)
  $p.AddArc($x, $y+$h-$r*2, $r*2, $r*2, 90, 90)
  $p.CloseFigure()
  return $p
}

# urun fotograflarinin kendi zemini (beyaz ya da kirik beyaz) kart zemini olur;
# aksi halde fotografin arka plani kartin uzerinde dikdortgen gibi gorunuyor
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

# orani bozmadan kutuya sigdir
function Draw-Photo($g, [string]$name, [single]$bx, [single]$by, [single]$bw, [single]$bh) {
  $path = Join-Path $photoDir $name
  if (-not (Test-Path $path)) { Write-Warning "gorsel yok: $name"; return }
  $img = [System.Drawing.Image]::FromFile($path)
  try {
    $scale = [Math]::Min($bw / $img.Width, $bh / $img.Height)
    $dw = $img.Width * $scale; $dh = $img.Height * $scale
    $dx = $bx + ($bw - $dw) / 2; $dy = $by + ($bh - $dh) / 2
    $g.DrawImage($img, $dx, $dy, $dw, $dh)
  } finally { $img.Dispose() }
}

function Draw-Footer($g, [bool]$dark, $domOverride) {
  $nameCol = $INK; $domCol = $MUTED
  if ($dark) { $nameCol = $WHITE; $domCol = $ACCENT_L }
  if ($domOverride) { $domCol = $domOverride }   # mavi zeminde ACCENT_L okunmuyor
  $fb = Font 30 'bold'; $fr = Font 28 'regular'
  $bn = New-Object System.Drawing.SolidBrush($nameCol)
  $bd = New-Object System.Drawing.SolidBrush($domCol)
  $wordmark = 'efem ileti' + [char]0x015F + 'im'   # "efem iletisim" (s-cedilla)
  $g.DrawString($wordmark, $fb, $bn, [single]$M, [single]$FOOT_Y, $SF)
  $dom = 'efemiletisim.com'
  $g.DrawString($dom, $fr, $bd, [single]($W - $M - (TextW $g $dom $fr)), [single]($FOOT_Y + 2), $SF)
  $bn.Dispose(); $bd.Dispose(); $fb.Dispose(); $fr.Dispose()
}

function Draw-Eyebrow($g, [string]$text, $color) {
  if ([string]::IsNullOrEmpty($text)) { return }
  $f = Font 25 'bold'
  $b = New-Object System.Drawing.SolidBrush($color)
  Draw-Tracked $g $text.ToUpper() $f $b ([single]$M) ([single]$M) 5.5
  $b.Dispose(); $f.Dispose()
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

# ---------- sablonlar ----------

function Render-Cover($item) {
  $dark = $true
  $bg = $NAVY; $eyeCol = $ACCENT_L; $subCol = $ONNAVY
  if ($item.theme -eq 'blue') { $bg = $BLUE; $eyeCol = $ONBLUE; $subCol = $ONBLUE }
  $c = New-Canvas $bg; $bmp = $c[0]; $g = $c[1]

  Draw-Eyebrow $g $item.eyebrow $eyeCol

  $fh = Font 96 'bold'
  $bw = New-Object System.Drawing.SolidBrush($WHITE)
  $lines = ($item.headline -split "`n").Count
  $y = 300
  if ($lines -ge 3) { $y = 245 }
  $endY = Draw-Wrapped $g $item.headline $fh $bw ([single]$M) ([single]$y) ([single]($W - 2*$M)) 104

  $accent = $WHITE
  if ($item.theme -eq 'blue') { $accent = $ONBLUE }
  $rb = New-Object System.Drawing.SolidBrush($accent)
  $g.FillRectangle($rb, [single]$M, [single]($endY + 46), [single]150, [single]5)

  $fs = Font 36 'regular'
  $bs = New-Object System.Drawing.SolidBrush($subCol)
  Draw-Wrapped $g $item.sub $fs $bs ([single]$M) ([single]($endY + 92)) ([single]($W - 2*$M - 60)) 50 | Out-Null

  $domCol = $null
  if ($item.theme -eq 'blue') { $domCol = $ONBLUE }
  Draw-Footer $g $dark $domCol
  $bw.Dispose(); $rb.Dispose(); $bs.Dispose(); $fh.Dispose(); $fs.Dispose()
  return @($bmp, $g)
}

function Render-Statement($item) {
  $c = New-Canvas $NAVY; $bmp = $c[0]; $g = $c[1]
  Draw-Eyebrow $g $item.eyebrow $ACCENT_L

  $fh = Font 88 'bold'
  $bw = New-Object System.Drawing.SolidBrush($WHITE)
  $endY = Draw-Wrapped $g $item.headline $fh $bw ([single]$M) 190 ([single]($W - 2*$M)) 96

  $rb = New-Object System.Drawing.SolidBrush($BLUE)
  $g.FillRectangle($rb, [single]$M, [single]($endY + 44), [single]150, [single]5)

  $fb = Font 34 'regular'
  $bb = New-Object System.Drawing.SolidBrush($ONNAVY)
  $endY = Draw-Wrapped $g $item.body $fb $bb ([single]$M) ([single]($endY + 90)) ([single]($W - 2*$M - 40)) 48

  $fi = Font 30 'semibold'
  $bi = New-Object System.Drawing.SolidBrush($WHITE)
  $iy = $endY + 120
  if ($iy -lt 700) { $iy = 700 }
  foreach ($line in $item.info) {
    $iy = Draw-Wrapped $g $line $fi $bi ([single]$M) ([single]$iy) ([single]($W - 2*$M)) 42
    $iy += 6
  }

  Draw-Footer $g $true
  $bw.Dispose(); $rb.Dispose(); $bb.Dispose(); $bi.Dispose(); $fh.Dispose(); $fb.Dispose(); $fi.Dispose()
  return @($bmp, $g)
}

function Render-Qa($item) {
  $c = New-Canvas $BLUE; $bmp = $c[0]; $g = $c[1]

  $fn = Font 132 'bold'
  $bn = New-Object System.Drawing.SolidBrush((C 127 168 247))
  $g.DrawString($item.num, $fn, $bn, [single]$M, [single]($M - 14), $SF)

  $fq = Font 68 'bold'
  $bq = New-Object System.Drawing.SolidBrush($WHITE)
  $endY = Draw-Wrapped $g $item.q $fq $bq ([single]$M) 530 ([single]($W - 2*$M)) 78

  $rb = New-Object System.Drawing.SolidBrush($ONBLUE)
  $g.FillRectangle($rb, [single]$M, [single]($endY + 40), [single]120, [single]5)

  $fa = Font 38 'regular'
  $ba = New-Object System.Drawing.SolidBrush($ONBLUE)
  Draw-Wrapped $g $item.a $fa $ba ([single]$M) ([single]($endY + 86)) ([single]($W - 2*$M - 30)) 52 | Out-Null

  Draw-Footer $g $true $ONBLUE
  $bn.Dispose(); $bq.Dispose(); $rb.Dispose(); $ba.Dispose(); $fn.Dispose(); $fq.Dispose(); $fa.Dispose()
  return @($bmp, $g)
}

function Render-Product($item) {
  $c = New-Canvas (Get-PhotoBg $item.photo); $bmp = $c[0]; $g = $c[1]
  Draw-Eyebrow $g $item.eyebrow $BLUE
  Draw-Photo $g $item.photo 140 175 800 520

  if ($item.badge) {
    $fbg = Font 27 'bold'
    $tw = TextW $g $item.badge $fbg
    $bw2 = $tw + 46; $bh2 = 60
    $bx = $W - $M - $bw2
    $path = RoundRect $bx ([single]($M - 12)) $bw2 $bh2 30
    $brb = New-Object System.Drawing.SolidBrush($BLUE)
    $g.FillPath($brb, $path)
    $bt = New-Object System.Drawing.SolidBrush($WHITE)
    $g.DrawString($item.badge, $fbg, $bt, [single]($bx + 23), [single]($M + 3), $SF)
    $brb.Dispose(); $bt.Dispose(); $fbg.Dispose(); $path.Dispose()
  }

  $y = 760
  if ($item.title) {
    $ft = Font 62 'bold'
    $bt2 = New-Object System.Drawing.SolidBrush($INK)
    $y = Draw-Wrapped $g $item.title $ft $bt2 ([single]$M) ([single]$y) ([single]($W - 2*$M)) 70
    $bt2.Dispose(); $ft.Dispose()
    $y += 16
  }
  $fs = Font 33 'regular'
  $bs = New-Object System.Drawing.SolidBrush($MUTED)
  Draw-Wrapped $g $item.sub $fs $bs ([single]$M) ([single]$y) ([single]($W - 2*$M)) 44 | Out-Null
  $bs.Dispose(); $fs.Dispose()

  $rb = New-Object System.Drawing.SolidBrush($BLUE)
  $g.FillRectangle($rb, [single]0, [single]($H - 10), [single]$W, [single]10)
  $rb.Dispose()

  Draw-Footer $g $false
  return @($bmp, $g)
}

function Render-ProductBullets($item) {
  $c = New-Canvas (Get-PhotoBg $item.photo); $bmp = $c[0]; $g = $c[1]
  Draw-Eyebrow $g $item.eyebrow $BLUE
  Draw-Photo $g $item.photo 190 165 700 450

  $ft = Font 56 'bold'
  $bt = New-Object System.Drawing.SolidBrush($INK)
  $y = Draw-Wrapped $g $item.title $ft $bt ([single]$M) 655 ([single]($W - 2*$M)) 64
  $bt.Dispose(); $ft.Dispose()

  $y += 28
  $fb = Font 31 'regular'
  $bb = New-Object System.Drawing.SolidBrush($MUTED)
  $bd = New-Object System.Drawing.SolidBrush($BLUE)
  foreach ($b in $item.bullets) {
    $g.FillRectangle($bd, [single]$M, [single]($y + 15), [single]14, [single]4)
    $y = Draw-Wrapped $g $b $fb $bb ([single]($M + 32)) ([single]$y) ([single]($W - 2*$M - 32)) 42
    $y += 10
  }
  $bb.Dispose(); $bd.Dispose(); $fb.Dispose()

  $rb = New-Object System.Drawing.SolidBrush($BLUE)
  $g.FillRectangle($rb, [single]0, [single]($H - 10), [single]$W, [single]10)
  $rb.Dispose()

  Draw-Footer $g $false
  return @($bmp, $g)
}

# katalog fotograflarindan kurulu kapak -- magaza fotografi cekilemedigi durumda
function Render-Montage($item) {
  $c = New-Canvas $NAVY; $bmp = $c[0]; $g = $c[1]
  Draw-Eyebrow $g $item.eyebrow $ACCENT_L

  $fh = Font 80 'bold'
  $bw = New-Object System.Drawing.SolidBrush($WHITE)
  $endY = Draw-Wrapped $g $item.headline $fh $bw ([single]$M) 175 ([single]($W - 2*$M)) 88

  $rb = New-Object System.Drawing.SolidBrush($BLUE)
  $g.FillRectangle($rb, [single]$M, [single]($endY + 38), [single]150, [single]5)

  $fs = Font 32 'regular'
  $bs = New-Object System.Drawing.SolidBrush($ONNAVY)
  Draw-Wrapped $g $item.sub $fs $bs ([single]$M) ([single]($endY + 82)) ([single]($W - 2*$M)) 44 | Out-Null

  # urun karolari: 4 x 210 px, aralarinda 20 px
  $n = $item.tiles.Count
  $tw = [single](($W - 2*$M - 20 * ($n - 1)) / $n)
  $ty = [single]530
  $bwt = New-Object System.Drawing.SolidBrush($WHITE)
  for ($i = 0; $i -lt $n; $i++) {
    $tx = [single]($M + $i * ($tw + 20))
    $path = RoundRect $tx $ty $tw $tw 18
    $g.FillPath($bwt, $path)
    $path.Dispose()
    Draw-Photo $g $item.tiles[$i] ($tx + 20) ($ty + 20) ($tw - 40) ($tw - 40)
  }

  $fi = Font 27 'semibold'
  $bi = New-Object System.Drawing.SolidBrush($WHITE)
  $iy = $ty + $tw + 62
  foreach ($line in $item.info) {
    $iy = Draw-Wrapped $g $line $fi $bi ([single]$M) ([single]$iy) ([single]($W - 2*$M)) 40
    $iy += 4
  }

  Draw-Footer $g $true
  $bw.Dispose(); $rb.Dispose(); $bs.Dispose(); $bwt.Dispose(); $bi.Dispose()
  $fh.Dispose(); $fs.Dispose(); $fi.Dispose()
  return @($bmp, $g)
}

# ---------- calistir ----------
$made = 0
foreach ($item in $spec.images) {
  switch ($item.tpl) {
    'cover'          { $r = Render-Cover $item }
    'statement'      { $r = Render-Statement $item }
    'qa'             { $r = Render-Qa $item }
    'product'        { $r = Render-Product $item }
    'productbullets' { $r = Render-ProductBullets $item }
    'montage'        { $r = Render-Montage $item }
    default          { Write-Warning "bilinmeyen sablon: $($item.tpl)"; continue }
  }
  $bmp = $r[0]; $g = $r[1]
  $dest = Join-Path $outDir $item.file
  $destDir = Split-Path $dest -Parent          # gonderi-NN klasorleri: toplu yuklemede sira korunur
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  $made++
  Write-Output "  $($item.file)"
}
Write-Output "$made gorsel uretildi -> $outDir"
