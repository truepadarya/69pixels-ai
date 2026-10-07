param([string]$Phase = 'before', [int]$Width = 390, [switch]$Motion, [string]$Route)
Add-Type -AssemblyName System.Drawing
$folder = Join-Path $PSScriptRoot "responsive-$Phase"
$names = if ($Motion) { @("$Width-motion-0-0", "$Width-motion-1-0.15", "$Width-motion-1-0.5", "$Width-motion-1-0.85", "$Width-motion-2-0.15", "$Width-motion-2-0.5", "$Width-motion-2-0.85", "$Width-motion-3-0", "$Width-motion-4-0.15", "$Width-motion-4-0.5", "$Width-motion-4-0.85", "$Width-motion-5-0", "$Width-motion-6-0", "$Width-motion-7-0.5", "$Width-motion-8-0", "$Width-motion-9-0") } else { @(0..9 | ForEach-Object { "$Width-$_" }) }
if ($Route) {
  $folder = Join-Path $folder 'routes'
  $names = @(Get-ChildItem -LiteralPath $folder -Filter "$Route-$Width-*.png" | Sort-Object { [int]($_.BaseName.Split('-')[-1]) } | ForEach-Object { $_.BaseName })
}
$thumbWidth = if ($Width -lt 600) { 260 } else { 400 }
if ($Route) { $thumbWidth = if ($Width -lt 600) { 200 } else { 320 } }
$thumbHeight = [int](900 * $thumbWidth / $Width)
if ($Width -lt 600) { $thumbHeight = [int](844 * $thumbWidth / $Width) }
$cols = 4
if ($Route) { $cols = 6 }
$rows = [int][Math]::Ceiling($names.Count / $cols)
$bitmap = New-Object System.Drawing.Bitmap ($cols * $thumbWidth), ($rows * ($thumbHeight + 28))
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(35,35,35))
$font = New-Object System.Drawing.Font 'Arial', 12
for ($i=0; $i -lt $names.Count; $i++) {
  $file = Join-Path $folder ($names[$i] + '.png')
  $x = ($i % $cols) * $thumbWidth
  $y = [int][Math]::Floor($i / $cols) * ($thumbHeight + 28)
  $graphics.DrawString($names[$i], $font, [System.Drawing.Brushes]::White, $x, $y)
  if (Test-Path $file) {
    $im = [System.Drawing.Image]::FromFile($file)
    $graphics.DrawImage($im, $x, ($y+28), $thumbWidth, $thumbHeight)
    $im.Dispose()
  }
}
$suffix = if ($Motion) { '-motion' } else { '' }
if ($Route) { $suffix = "-$Route" }
$bitmap.Save((Join-Path $folder "sheet-$Width$suffix.png"))
$graphics.Dispose()
$bitmap.Dispose()
$font.Dispose()
