Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path 'build'

function Resize-And-Save-Bmp($srcPath, $dstPath, $targetW, $targetH) {
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $srcRatio = $srcImg.Width / $srcImg.Height
    $dstRatio = $targetW / $targetH
    
    if ($srcRatio -gt $dstRatio) {
        $drawH = $targetH
        $drawW = [int]($targetH * $srcRatio)
        $drawX = [int](($targetW - $drawW) / 2)
        $drawY = 0
    } else {
        $drawW = $targetW
        $drawH = [int]($targetW / $srcRatio)
        $drawX = 0
        $drawY = [int](($targetH - $drawH) / 2)
    }

    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 252, 254))
    $g.FillRectangle($bgBrush, 0, 0, $targetW, $targetH)

    $g.DrawImage($srcImg, $drawX, $drawY, $drawW, $drawH)
    $g.Dispose()
    $srcImg.Dispose()

    $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created: $dstPath ($targetW x $targetH)"
}

$src = (Resolve-Path "src\main\assets\careflow-installer-banner.png").Path
Resize-And-Save-Bmp $src "build\installerHeader.bmp" 150 57
Resize-And-Save-Bmp $src "build\installerSidebar.bmp" 164 314
Resize-And-Save-Bmp $src "build\uninstallerSidebar.bmp" 164 314
