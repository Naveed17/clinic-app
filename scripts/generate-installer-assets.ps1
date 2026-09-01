Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path 'build' | Out-Null
New-Item -ItemType Directory -Force -Path 'src\main\assets' | Out-Null

function Create-Installer-Sidebar($dstBmpPath, $dstPngPath) {
    # Render at 4x scale (656 x 1256) for maximum anti-aliasing and crispness, then downsample to 164 x 314
    $scale = 4
    $w = 164 * $scale
    $h = 314 * $scale

    $bmpHigh = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmpHigh)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # 1. Background Gradient (Deep obsidian to navy)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 4, 7, 20),      # Top: Deep space
        [System.Drawing.Color]::FromArgb(255, 10, 22, 54),    # Bottom: Rich midnight navy
        90.0
    )
    $g.FillRectangle($bgBrush, $rect)
    $bgBrush.Dispose()

    # 2. Ambient Cyan/Blue Glow behind logo (Radial/Path Gradient)
    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowRect = New-Object System.Drawing.Rectangle([int]($w * 0.1), [int]($h * 0.12), [int]($w * 0.8), [int]($h * 0.35))
    $glowPath.AddEllipse($glowRect)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, 37, 99, 235) # Vibrant electric blue
    $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 4, 7, 20))
    $g.FillPath($glowBrush, $glowPath)
    $glowBrush.Dispose()
    $glowPath.Dispose()

    # Subtle top light arc
    $arcPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $arcRect = New-Object System.Drawing.Rectangle(-[int]($w * 0.5), -[int]($h * 0.15), [int]($w * 2), [int]($h * 0.4))
    $arcPath.AddEllipse($arcRect)
    $arcBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($arcPath)
    $arcBrush.CenterColor = [System.Drawing.Color]::FromArgb(35, 56, 189, 248) # Cyan glow
    $arcBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 4, 7, 20))
    $g.FillPath($arcBrush, $arcPath)
    $arcBrush.Dispose()
    $arcPath.Dispose()

    # 3. Draw 3D Layered Isometric Emblem (Image 2 style)
    # Center of emblem:
    $cx = [int]($w / 2)
    $cy = [int]($h * 0.28)
    $layerWidth = [int](64 * $scale)
    $layerHeight = [int](32 * $scale)
    $layerThickness = [int](10 * $scale)
    $layerSpacing = [int](22 * $scale)

    # Function to create an isometric rounded diamond plate
    function Draw-Isometric-Layer($centerY, $colorTop, $colorFront, $colorSide, $isTopLayer) {
        $hw = [int]($layerWidth / 2)
        $hh = [int]($layerHeight / 2)
        $th = $layerThickness

        # Points for top surface of layer
        $pTop = New-Object System.Drawing.Point($cx, ($centerY - $hh))
        $pRight = New-Object System.Drawing.Point(($cx + $hw), $centerY)
        $pBottom = New-Object System.Drawing.Point($cx, ($centerY + $hh))
        $pLeft = New-Object System.Drawing.Point(($cx - $hw), $centerY)

        # Front-left side facet
        $sideLeftPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $sideLeftPath.AddPolygon(@(
            $pLeft,
            $pBottom,
            (New-Object System.Drawing.Point($cx, ($centerY + $hh + $th))),
            (New-Object System.Drawing.Point(($cx - $hw), ($centerY + $th)))
        ))
        $sideLeftBrush = New-Object System.Drawing.SolidBrush($colorSide)
        $g.FillPath($sideLeftBrush, $sideLeftPath)
        $sideLeftBrush.Dispose()
        $sideLeftPath.Dispose()

        # Front-right side facet
        $sideRightPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $sideRightPath.AddPolygon(@(
            $pBottom,
            $pRight,
            (New-Object System.Drawing.Point(($cx + $hw), ($centerY + $th))),
            (New-Object System.Drawing.Point($cx, ($centerY + $hh + $th)))
        ))
        $sideRightBrush = New-Object System.Drawing.SolidBrush($colorFront)
        $g.FillPath($sideRightBrush, $sideRightPath)
        $sideRightBrush.Dispose()
        $sideRightPath.Dispose()

        # Top surface facet
        $topPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $topPath.AddPolygon(@($pTop, $pRight, $pBottom, $pLeft))
        $topBrush = New-Object System.Drawing.SolidBrush($colorTop)
        $g.FillPath($topBrush, $topPath)

        # Top highlight border
        $highlightPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 255, 255, 255), [float](1.5 * $scale))
        if ($isTopLayer) {
            $g.DrawLine($highlightPen, $pLeft, $pTop)
            $g.DrawLine($highlightPen, $pTop, $pRight)
        }
        $highlightPen.Dispose()
        $topBrush.Dispose()
        $topPath.Dispose()
    }

    # Shadow under bottom layer
    $shPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shRect = New-Object System.Drawing.Rectangle(($cx - [int]($layerWidth * 0.55)), ($cy + $layerSpacing + [int]($layerHeight * 0.3)), [int]($layerWidth * 1.1), [int]($layerHeight * 0.8))
    $shPath.AddEllipse($shRect)
    $shBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($shPath)
    $shBrush.CenterColor = [System.Drawing.Color]::FromArgb(140, 0, 0, 0)
    $shBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.FillPath($shBrush, $shPath)
    $shBrush.Dispose()
    $shPath.Dispose()

    # Layer 3 (Bottom) - Deep Royal/Sapphire Blue
    Draw-Isometric-Layer `
        ($cy + $layerSpacing) `
        ([System.Drawing.Color]::FromArgb(255, 29, 78, 216)) `
        ([System.Drawing.Color]::FromArgb(255, 20, 56, 160)) `
        ([System.Drawing.Color]::FromArgb(255, 15, 42, 125)) `
        $false

    # Layer 2 (Middle) - Electric Cobalt Blue
    Draw-Isometric-Layer `
        $cy `
        ([System.Drawing.Color]::FromArgb(255, 37, 99, 235)) `
        ([System.Drawing.Color]::FromArgb(255, 29, 78, 216)) `
        ([System.Drawing.Color]::FromArgb(255, 24, 65, 185)) `
        $false

    # Layer 1 (Top) - Translucent Glowing Sky/Cyan
    Draw-Isometric-Layer `
        ($cy - $layerSpacing) `
        ([System.Drawing.Color]::FromArgb(255, 56, 189, 248)) `
        ([System.Drawing.Color]::FromArgb(255, 14, 165, 233)) `
        ([System.Drawing.Color]::FromArgb(255, 2, 132, 199)) `
        $true

    # Medical Cross Symbol glowing on top layer center
    $crossTopY = $cy - $layerSpacing
    $crossThick = [int](3.5 * $scale)
    $crossLen = [int](14 * $scale)
    $crossBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 255, 255, 255))
    $g.FillRectangle($crossBrush, ($cx - [int]($crossLen / 2)), ($crossTopY - [int]($crossThick / 2)), $crossLen, $crossThick)
    $g.FillRectangle($crossBrush, ($cx - [int]($crossThick / 2)), ($crossTopY - [int]($crossLen / 2)), $crossThick, $crossLen)
    $crossBrush.Dispose()

    # 4. Typography - "CAREFLOW" Brand Name
    $strFormat = New-Object System.Drawing.StringFormat
    $strFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $strFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Title Font
    $titleFont = New-Object System.Drawing.Font("Segoe UI", [float](18 * $scale), [System.Drawing.FontStyle]::Bold)
    $titleY = [int]($h * 0.49)
    $titleRect = New-Object System.Drawing.RectangleF(0, $titleY, $w, [int](32 * $scale))

    # Glow behind title
    $titleGlowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 56, 189, 248))
    $glowOffset = [float](1.5 * $scale)
    $titleGlowRect = New-Object System.Drawing.RectangleF(0, ($titleY + $glowOffset), $w, [int](32 * $scale))
    $g.DrawString("CAREFLOW", $titleFont, $titleGlowBrush, $titleGlowRect, $strFormat)
    $titleGlowBrush.Dispose()

    # Crisp White Title
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g.DrawString("CAREFLOW", $titleFont, $titleBrush, $titleRect, $strFormat)
    $titleBrush.Dispose()
    $titleFont.Dispose()

    # Subtitle: "CLINIC MANAGEMENT"
    $subFont = New-Object System.Drawing.Font("Segoe UI", [float](7.5 * $scale), [System.Drawing.FontStyle]::Bold)
    $subY = [int]($h * 0.56)
    $subRect = New-Object System.Drawing.RectangleF(0, $subY, $w, [int](18 * $scale))
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248)) # Vibrant Cyan
    $g.DrawString("CLINIC MANAGEMENT", $subFont, $subBrush, $subRect, $strFormat)
    $subBrush.Dispose()
    $subFont.Dispose()

    # Glowing divider line
    $divY = [int]($h * 0.62)
    $divW = [int]($w * 0.55)
    $divX = [int](($w - $divW) / 2)
    $divPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 56, 189, 248), [float](1.5 * $scale))
    $g.DrawLine($divPen, $divX, $divY, ($divX + $divW), $divY)
    $divPen.Dispose()

    # Center dot on divider
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
    $dotR = [int](3 * $scale)
    $g.FillEllipse($dotBrush, ($cx - $dotR), ($divY - $dotR), ($dotR * 2), ($dotR * 2))
    $dotBrush.Dispose()

    # 5. Feature Highlights (Centered with safe margins)
    $feats = @("Smart Patient Records", "Fast Billing & Tokens", "Multi-Clinic Sync")
    $featFont = New-Object System.Drawing.Font("Segoe UI", [float](7.0 * $scale), [System.Drawing.FontStyle]::Regular)
    $featBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 148, 163, 184)) # Slate 400
    $featStartY = [int]($h * 0.67)
    $featSpacing = [int](22 * $scale)

    for ($i = 0; $i -lt $feats.Length; $i++) {
        $currY = $featStartY + ($i * $featSpacing)
        $featRect = New-Object System.Drawing.RectangleF(0, $currY, $w, [int](18 * $scale))
        $g.DrawString($feats[$i], $featFont, $featBrush, $featRect, $strFormat)
    }
    $featBrush.Dispose()
    $featFont.Dispose()

    # 6. Bottom Badge: "OFFICIAL SETUP"
    $badgeFont = New-Object System.Drawing.Font("Segoe UI", [float](6.5 * $scale), [System.Drawing.FontStyle]::Bold)
    $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 71, 85, 105)) # Slate 500
    $badgeRect = New-Object System.Drawing.RectangleF(0, [int]($h * 0.89), $w, [int](16 * $scale))
    $g.DrawString("ENTERPRISE EDITION", $badgeFont, $badgeBrush, $badgeRect, $strFormat)
    $badgeBrush.Dispose()
    $badgeFont.Dispose()

    $g.Dispose()

    # 7. Downsample to target 164 x 314 with bicubic filtering
    $targetW = 164
    $targetH = 314
    $finalBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $fg = [System.Drawing.Graphics]::FromImage($finalBmp)
    $fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $fg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $fg.DrawImage($bmpHigh, 0, 0, $targetW, $targetH)
    $fg.Dispose()
    $bmpHigh.Dispose()

    # Save 24-bit BMP (NSIS requirement)
    $finalBmp.Save($dstBmpPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    Write-Host "Created NSIS Sidebar BMP: $dstBmpPath ($targetW x $targetH)"

    # Also save PNG if requested
    if ($dstPngPath) {
        $finalBmp.Save($dstPngPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Created PNG copy: $dstPngPath"
    }

    $finalBmp.Dispose()
}

function Create-Installer-Header($dstBmpPath) {
    # 150 x 57 px for NSIS Header
    $scale = 4
    $w = 150 * $scale
    $h = 57 * $scale

    $bmpHigh = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmpHigh)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # Background Gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 4, 7, 20),
        [System.Drawing.Color]::FromArgb(255, 12, 25, 60),
        0.0
    )
    $g.FillRectangle($bgBrush, $rect)
    $bgBrush.Dispose()

    # Mini 3D emblem on the right
    $cx = [int]($w * 0.78)
    $cy = [int]($h * 0.5)
    $layerWidth = [int](32 * $scale)
    $layerHeight = [int](16 * $scale)
    $layerThickness = [int](4 * $scale)
    $layerSpacing = [int](8 * $scale)

    function Draw-Mini-Layer($centerY, $colorTop, $colorFront) {
        $hw = [int]($layerWidth / 2)
        $hh = [int]($layerHeight / 2)
        $pTop = New-Object System.Drawing.Point($cx, ($centerY - $hh))
        $pRight = New-Object System.Drawing.Point(($cx + $hw), $centerY)
        $pBottom = New-Object System.Drawing.Point($cx, ($centerY + $hh))
        $pLeft = New-Object System.Drawing.Point(($cx - $hw), $centerY)

        # Front side
        $sidePath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $sidePath.AddPolygon(@(
            $pLeft, $pBottom, $pRight,
            (New-Object System.Drawing.Point(($cx + $hw), ($centerY + $layerThickness))),
            (New-Object System.Drawing.Point($cx, ($centerY + $hh + $layerThickness))),
            (New-Object System.Drawing.Point(($cx - $hw), ($centerY + $layerThickness)))
        ))
        $sb = New-Object System.Drawing.SolidBrush($colorFront)
        $g.FillPath($sb, $sidePath)
        $sb.Dispose()
        $sidePath.Dispose()

        # Top
        $tp = New-Object System.Drawing.Drawing2D.GraphicsPath
        $tp.AddPolygon(@($pTop, $pRight, $pBottom, $pLeft))
        $tb = New-Object System.Drawing.SolidBrush($colorTop)
        $g.FillPath($tb, $tp)
        $tb.Dispose()
        $tp.Dispose()
    }

    Draw-Mini-Layer ($cy + $layerSpacing) ([System.Drawing.Color]::FromArgb(255, 29, 78, 216)) ([System.Drawing.Color]::FromArgb(255, 20, 56, 160))
    Draw-Mini-Layer $cy ([System.Drawing.Color]::FromArgb(255, 37, 99, 235)) ([System.Drawing.Color]::FromArgb(255, 29, 78, 216))
    Draw-Mini-Layer ($cy - $layerSpacing) ([System.Drawing.Color]::FromArgb(255, 56, 189, 248)) ([System.Drawing.Color]::FromArgb(255, 14, 165, 233))

    # Text on the left
    $strFormat = New-Object System.Drawing.StringFormat
    $strFormat.Alignment = [System.Drawing.StringAlignment]::Near
    $strFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    $titleFont = New-Object System.Drawing.Font("Segoe UI", [float](10 * $scale), [System.Drawing.FontStyle]::Bold)
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g.DrawString("CareFlow", $titleFont, $titleBrush, [float](12 * $scale), [float]($h * 0.35), $strFormat)
    $titleBrush.Dispose()
    $titleFont.Dispose()

    $subFont = New-Object System.Drawing.Font("Segoe UI", [float](5.5 * $scale), [System.Drawing.FontStyle]::Bold)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
    $g.DrawString("CLINIC SUITE", $subFont, $subBrush, [float](12 * $scale), [float]($h * 0.68), $strFormat)
    $subBrush.Dispose()
    $subFont.Dispose()

    $g.Dispose()

    # Downsample to 150 x 57
    $finalBmp = New-Object System.Drawing.Bitmap(150, 57, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $fg = [System.Drawing.Graphics]::FromImage($finalBmp)
    $fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $fg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $fg.DrawImage($bmpHigh, 0, 0, 150, 57)
    $fg.Dispose()
    $bmpHigh.Dispose()

    $finalBmp.Save($dstBmpPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    Write-Host "Created NSIS Header BMP: $dstBmpPath (150 x 57)"
    $pngPath = [System.IO.Path]::ChangeExtension($dstBmpPath, ".png")
    $finalBmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $finalBmp.Dispose()
}

# Generate all installer assets
Create-Installer-Sidebar "build\installerSidebar.bmp" "src\main\assets\careflow-installer-banner.png"
Create-Installer-Sidebar "build\uninstallerSidebar.bmp" $null
Create-Installer-Header "build\installerHeader.bmp"
