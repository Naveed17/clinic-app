Add-Type -AssemblyName System.Drawing

$bannerPath = (Resolve-Path "src/renderer/src/assets/careflow-installer-banner.png").Path
$logoPath = (Resolve-Path "src/renderer/src/assets/careflow-logo.png").Path

Write-Host "Source Banner: $bannerPath"
Write-Host "Source Logo: $logoPath"

# Function to create high quality resized BMP
function Create-HeaderBmp($srcPath, $outPath, $targetWidth = 150, $targetHeight = 57) {
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    
    # Target 24bpp RGB bitmap (NSIS standard)
    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Set high quality rendering
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Background color white for header
    $g.Clear([System.Drawing.Color]::White)
    
    # Scale to fit inside 150x57 maintaining aspect ratio
    $srcAspect = $srcImg.Width / $srcImg.Height
    $targetAspect = $targetWidth / $targetHeight
    
    if ($srcAspect -gt $targetAspect) {
        $destW = $targetWidth
        $destH = [int]($targetWidth / $srcAspect)
        $destX = 0
        $destY = [int](($targetHeight - $destH) / 2)
    } else {
        $destH = $targetHeight
        $destW = [int]($targetHeight * $srcAspect)
        $destX = [int](($targetWidth - $destW) / 2)
        $destY = 0
    }
    
    $g.DrawImage($srcImg, $destX, $destY, $destW, $destH)
    
    # Save as 24-bit BMP
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    
    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
    Write-Host "Created Header BMP: $outPath ($targetWidth x $targetHeight)"
}

function Create-SidebarBmp($srcPath, $outPath, $targetWidth = 164, $targetHeight = 314) {
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    
    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Sleek dark background matching modern installer theme or transparent white
    # Let's check: NSIS installer sidebar background:
    # Modern UI sidebar: #0b1528 or crisp clean gradient / background
    $rect = New-Object System.Drawing.Rectangle(0, 0, $targetWidth, $targetHeight)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(10, 25, 47),
        [System.Drawing.Color]::FromArgb(15, 32, 67),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
    
    # Center the banner image in the sidebar
    $srcAspect = $srcImg.Width / $srcImg.Height
    $destW = [int]($targetWidth * 0.92)
    $destH = [int]($destW / $srcAspect)
    $destX = [int](($targetWidth - $destW) / 2)
    $destY = [int](($targetHeight - $destH) / 2)
    
    $g.DrawImage($srcImg, $destX, $destY, $destW, $destH)
    
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    
    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
    Write-Host "Created Sidebar BMP: $outPath ($targetWidth x $targetHeight)"
}

Create-HeaderBmp $bannerPath "build/installerHeader.bmp" 150 57
Create-SidebarBmp $bannerPath "build/installerSidebar.bmp" 164 314
Create-SidebarBmp $bannerPath "build/uninstallerSidebar.bmp" 164 314

Write-Host "All installer BMPs successfully generated from $bannerPath!"
