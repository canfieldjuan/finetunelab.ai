# Auto Fix All Linux Paths - No Confirmation Needed
# Simpler version compatible with older PowerShell

Write-Host "Fixing all Linux paths to Windows paths..." -ForegroundColor Cyan
Write-Host ""

$filesFixed = 0
$totalReplacements = 0

# Get all relevant files (excluding generated directories)
$files = Get-ChildItem -Path . -Recurse -Include *.ts,*.tsx,*.js,*.json,*.yaml,*.yml,*.md,*.sh,*.ps1 |
    Where-Object {
        $_.FullName -notmatch "node_modules|\.next|\.git|venv|dist|build|__pycache__"
    }

Write-Host "Scanning $($files.Count) files..." -ForegroundColor Yellow
Write-Host ""

foreach ($file in $files) {
    try {
        # Read file content (compatible with older PowerShell)
        $content = Get-Content $file.FullName | Out-String
        $originalContent = $content

        # Apply replacements
        $content = $content -replace 'C:/Users/Juan/Desktop/Dev_Ops', 'C:/Users/Juan/Desktop/Dev_Ops'
        $content = $content -replace 'C:/Users/Juan', 'C:/Users/Juan'
        $content = $content -replace 'Dev_Ops', 'Dev_Ops'

        # If content changed, write it back
        if ($content -ne $originalContent) {
            $content | Set-Content -Path $file.FullName -Force
            $filesFixed++

            $relativePath = $file.FullName.Replace($PWD.Path + "\", "")
            Write-Host "  [FIXED] $relativePath" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  [ERROR] $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete!" -ForegroundColor Green
Write-Host "Files fixed: $filesFixed" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

