# Fix All Linux Paths to Windows Paths
# Run this script from the project root
# Usage: powershell -ExecutionPolicy Bypass -File scripts/fix-all-paths.ps1

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Path Migration: Linux to Windows" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Define replacements
$replacements = @(
    @{
        Find = "C:/Users/Juan/Desktop/Dev_Ops"
        Replace = "C:/Users/Juan/Desktop/Dev_Ops"
        Description = "Main project path"
    },
    @{
        Find = "C:/Users/Juan"
        Replace = "C:/Users/Juan"
        Description = "Home directory"
    },
    @{
        Find = "Dev_Ops"
        Replace = "Dev_Ops"
        Description = "Directory name"
    }
)

# Directories to exclude
$excludeDirs = @(
    "node_modules",
    ".next",
    ".git",
    "venv",
    "dist",
    "build",
    "__pycache__"
)

# File extensions to process
$includeExtensions = @(
    "*.ts",
    "*.tsx",
    "*.js",
    "*.jsx",
    "*.json",
    "*.yaml",
    "*.yml",
    "*.md",
    "*.sh",
    "*.ps1"
)

# Build exclude pattern
$excludePattern = $excludeDirs -join "|"

Write-Host "Step 1: Searching for files with old paths..." -ForegroundColor Yellow
Write-Host ""

# Find all files (excluding certain directories)
$allFiles = Get-ChildItem -Path . -Recurse -Include $includeExtensions |
    Where-Object { $_.FullName -notmatch $excludePattern }

Write-Host "Found $($allFiles.Count) files to scan" -ForegroundColor Green
Write-Host ""

# Scan files for matches
$filesToFix = @()
foreach ($file in $allFiles) {
    $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
    if ($content) {
        foreach ($replacement in $replacements) {
            if ($content -match [regex]::Escape($replacement.Find)) {
                $filesToFix += @{
                    File = $file.FullName
                    RelativePath = $file.FullName.Replace($PWD.Path + "\", "")
                }
                break
            }
        }
    }
}

Write-Host "Step 2: Files that need fixing:" -ForegroundColor Yellow
Write-Host ""

if ($filesToFix.Count -eq 0) {
    Write-Host "No files need fixing! All paths are already correct." -ForegroundColor Green
    exit 0
}

$uniqueFiles = $filesToFix.RelativePath | Select-Object -Unique
foreach ($file in $uniqueFiles) {
    Write-Host "  - $file" -ForegroundColor White
}

Write-Host ""
Write-Host "Total: $($uniqueFiles.Count) files" -ForegroundColor Cyan
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Do you want to proceed with the replacements? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Step 3: Applying replacements..." -ForegroundColor Yellow
Write-Host ""

$filesFixed = 0
$totalReplacements = 0

foreach ($fileInfo in $filesToFix) {
    $file = $fileInfo.File

    try {
        $content = Get-Content -Path $file -Raw
        $originalContent = $content
        $fileReplacements = 0

        foreach ($replacement in $replacements) {
            $matches = ([regex]::Matches($content, [regex]::Escape($replacement.Find))).Count
            if ($matches -gt 0) {
                $content = $content -replace [regex]::Escape($replacement.Find), $replacement.Replace
                $fileReplacements += $matches
            }
        }

        if ($content -ne $originalContent) {
            Set-Content -Path $file -Value $content -NoNewline
            $filesFixed++
            $totalReplacements += $fileReplacements

            $relativePath = $file.Replace($PWD.Path + "\", "")
            Write-Host "  [OK] Fixed: $relativePath ($fileReplacements replacements)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  [ERROR] Error fixing: $file" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Files fixed: $filesFixed" -ForegroundColor Green
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Green
Write-Host ""
Write-Host "Replacements applied:" -ForegroundColor Yellow
foreach ($replacement in $replacements) {
    Write-Host "  $($replacement.Find) -> $($replacement.Replace)" -ForegroundColor White
}
Write-Host ""
Write-Host "Done! All paths have been updated." -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review changes with: git diff" -ForegroundColor White
Write-Host "  2. Test the application: npm run dev" -ForegroundColor White
Write-Host "  3. Commit changes if everything works" -ForegroundColor White
Write-Host ""

