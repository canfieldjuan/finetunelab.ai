$file = "C:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\training-templates.ts"
$content = Get-Content $file -Raw
$content = $content -replace 'dataloader_num_workers: 0,', 'dataloader_num_workers: 8,'
$content = $content -replace 'dataloader_prefetch_factor: null,', 'dataloader_prefetch_factor: 2,'
Set-Content $file -Value $content -NoNewline
Write-Host "✅ Fixed all dataloader settings in training-templates.ts"
Write-Host "   - Changed dataloader_num_workers: 0 -> 8"
Write-Host "   - Changed dataloader_prefetch_factor: null -> 2"
