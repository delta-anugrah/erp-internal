@echo off
rem ERP Delta Anugrah: a copy of every nightly backup on this PC (docs/cadangan-pc.md).
rem Run once on the admin PC (double click). The PowerShell part below #PS-START does the work; it holds no secret.
setlocal
title ERP Delta Anugrah - salinan backup di PC ini
rem Through an env var, so a path with an apostrophe still works.
set "SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:SELF); $m=[char]10+'#'+'PS-START'; $i=$t.IndexOf($m); if ($i -lt 0) { exit 9 }; iex $t.Substring($i+$m.Length)"
echo.
pause
exit /b

#PS-START
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# rclone pinned: version and the SHA256 of its Windows zip from downloads.rclone.org/<version>/SHA256SUMS.
$VERSI = 'v1.76.0'
$SHA256 = '8b4fd2737ade4e70c057ef4a49deb7cffe94b0fb9d7587c189d149823f21a1dc'
$URL = "https://downloads.rclone.org/$VERSI/rclone-$VERSI-windows-amd64.zip"
$SUMBER_BAWAAN = 'erp-delta-anugrah-backup/erp'
$TUGAS = 'ERP Delta Anugrah - tarik backup'
$JAM = '03:00'

function Gagal($teks) {
	Write-Host ''
	Write-Host "GAGAL: $teks" -ForegroundColor Red
	exit 1
}
function Tanya($teks, $bawaan) {
	while ($true) {
		if ($bawaan) { $j = Read-Host "$teks [Enter = $bawaan]" } else { $j = Read-Host $teks }
		if ([string]::IsNullOrWhiteSpace($j)) { $j = $bawaan }
		if (-not [string]::IsNullOrWhiteSpace($j)) { return $j.Trim() }
	}
}
# A native command: its stderr is text, never a terminating error (Windows PowerShell 5.1 with 'Stop').
function Jalan {
	$ErrorActionPreference = 'Continue'
	$keluar = & $exe @args 2>&1 | ForEach-Object { "$_" }
	return $keluar
}

Write-Host ''
Write-Host '=== Salinan backup ERP di PC ini ===' -ForegroundColor Cyan
Write-Host 'Tiap malam PC ini mengambil backup terbaru dari R2 (Cloudflare) ke sebuah folder.'
Write-Host 'Folder itu hanya bisa dibuka akun Windows ini: isinya seluruh data perusahaan.'
Write-Host ''

$folder = Tanya 'Folder penyimpanan' 'C:\CadanganERP'
$data = Join-Path $folder 'backup'
$alat = Join-Path $folder 'alat'
$exe = Join-Path $alat 'rclone.exe'
$conf = Join-Path $alat 'rclone.conf'
$tarik = Join-Path $alat 'tarik.ps1'
New-Item -ItemType Directory -Force -Path $data, $alat | Out-Null

# Only this user, SYSTEM (S-1-5-18) and Administrators (S-1-5-32-544), by SID: any Windows language, and
# Microsoft or work accounts whose DOMAIN\name icacls would not take.
$identitas = [Security.Principal.WindowsIdentity]::GetCurrent()
$saya = $identitas.Name
$sidSaya = '*' + $identitas.User.Value
& icacls $folder /inheritance:r /grant:r "${sidSaya}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { Gagal "tidak bisa mengunci folder $folder." }

$sudahAda = $false
if (Test-Path $exe) { $sudahAda = ((Jalan version) -join ' ') -match [regex]::Escape("rclone $VERSI") }
if (-not $sudahAda) {
	Write-Host "Mengunduh rclone $VERSI ..."
	$zip = Join-Path $env:TEMP "rclone-$VERSI.zip"
	$buka = Join-Path $env:TEMP "rclone-$VERSI"
	Invoke-WebRequest -Uri $URL -OutFile $zip -UseBasicParsing
	if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $SHA256) {
		Remove-Item $zip -Force
		Gagal 'file rclone yang terunduh tidak cocok dengan checksum resminya. Tidak dipasang.'
	}
	Expand-Archive -Path $zip -DestinationPath $buka -Force
	Copy-Item (Join-Path $buka "rclone-$VERSI-windows-amd64\rclone.exe") $exe -Force
	Remove-Item $zip, $buka -Recurse -Force
}
Write-Host "rclone $VERSI siap." -ForegroundColor Green

Write-Host ''
Write-Host 'Isi dari Bitwarden, item "Delta Anugrah ERP Prod R2 backup (read-only)".'
while ($true) {
	$endpoint = Tanya 'Endpoint R2 (https://....r2.cloudflarestorage.com)' ''
	if ($endpoint -match '^https://[^/\s]+\.r2\.cloudflarestorage\.com/?$') { break }
	Write-Host 'Bentuknya https://<account id>.r2.cloudflarestorage.com' -ForegroundColor Yellow
}
$kunci = Tanya 'Access Key ID' ''
$rahasiaAman = Read-Host 'Secret Access Key (tidak terlihat saat diketik)' -AsSecureString
$rahasia = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($rahasiaAman))
$sumber = 'r2:' + (Tanya 'Bucket/folder backup' $SUMBER_BAWAAN).Trim('/')

# Written as a file, so the secret never shows in a command line.
$isi = "[r2]`ntype = s3`nprovider = Cloudflare`naccess_key_id = $kunci`nsecret_access_key = $rahasia`nendpoint = $endpoint`nno_check_bucket = true`n"
[IO.File]::WriteAllText($conf, $isi)

Write-Host ''
Write-Host 'Memeriksa akses ke R2 ...'
$daftar = Jalan lsf $sumber --config $conf
if ($LASTEXITCODE -ne 0) { Gagal ("tidak bisa membaca $sumber.`n" + ($daftar -join "`n")) }
if (-not ($daftar | Where-Object { $_ -like '*-database*.sql.gz' })) {
	Gagal "belum ada file backup di $sumber. Cek nama bucket dan folder."
}
# A key that can write would let a virus on this PC delete the backups in R2.
$uji = "$sumber/_uji-tulis-dari-pc.txt"
$hasilUji = Jalan touch $uji --config $conf
if ($LASTEXITCODE -eq 0) {
	Jalan deletefile $uji --config $conf | Out-Null
	Remove-Item $conf -Force
	Gagal 'key ini BISA menulis ke R2. Buat key khusus baca (Object Read only) di Cloudflare, lalu jalankan file ini lagi.'
}
# Only a refusal proves the key is read-only; a network error proves nothing.
if (-not (($hasilUji -join ' ') -match 'AccessDenied|403|Forbidden')) {
	Gagal ("tidak bisa memastikan key ini khusus baca. Jalankan lagi.`n" + ($hasilUji -join "`n"))
}
Write-Host 'Akses baca OK, dan key ini memang tidak bisa menulis.' -ForegroundColor Green

# The nightly pull: copy (never sync, so a file gone from R2 stays here), then delete copies older than 30 days,
# but only while a fresh backup arrived; a missing or stale backup shows a warning window.
$skrip = @'
$ErrorActionPreference = 'Continue'
$alat = Split-Path -Parent $MyInvocation.MyCommand.Path
$folder = Split-Path -Parent $alat
$data = Join-Path $folder 'backup'
$log = Join-Path $folder 'log.txt'
$exe = Join-Path $alat 'rclone.exe'
$conf = Join-Path $alat 'rclone.conf'
$sumber = '__SUMBER__'
$SIMPAN_HARI = 30
$BASI_JAM = 48
function Tulis($t) { Add-Content -Path $log -Value ('{0:yyyy-MM-dd HH:mm} {1}' -f (Get-Date), $t) }

# --max-age: what the clean-up below deleted is not fetched again the next night.
& $exe copy $sumber $data --max-age "$($SIMPAN_HARI)d" --config $conf --log-file $log --log-level NOTICE
$ok = ($LASTEXITCODE -eq 0)
$baru = Get-ChildItem $data -Filter '*-database*.sql.gz' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $ok -or -not $baru -or $baru.LastWriteTime -lt (Get-Date).AddHours(-$BASI_JAM)) {
	if (-not $ok) { $pesan = 'Backup ERP gagal diambil dari R2 (cek internet). Detail: ' + $log }
	else { $pesan = 'Backup ERP terbaru di PC ini lebih tua dari 2 hari. Server mungkin berhenti membuat backup: kabari tim IT.' }
	Tulis "PERINGATAN: $pesan"
	Add-Type -AssemblyName System.Windows.Forms
	[System.Windows.Forms.MessageBox]::Show($pesan, 'Backup ERP Delta Anugrah', 'OK', 'Warning') | Out-Null
	exit 1
}
Get-ChildItem $data -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$SIMPAN_HARI) } | Remove-Item -Force
Tulis "OK $($baru.Name)"
'@
[IO.File]::WriteAllText($tarik, $skrip.Replace('__SUMBER__', $sumber))

$aksi = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$tarik`""
$pemicu = New-ScheduledTaskTrigger -Daily -At $JAM
$atur = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$pelaku = New-ScheduledTaskPrincipal -UserId $saya -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TUGAS -Action $aksi -Trigger $pemicu -Settings $atur -Principal $pelaku -Force | Out-Null
Write-Host "Jadwal dipasang: tiap hari jam $JAM (kalau PC mati, jalan begitu PC nyala)." -ForegroundColor Green

Write-Host ''
Write-Host 'Mengambil backup pertama sekarang (bisa beberapa menit) ...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tarik
$jumlah = @(Get-ChildItem $data -File).Count
if ($LASTEXITCODE -ne 0) { Gagal "pengambilan pertama gagal. Lihat $folder\log.txt" }

Write-Host ''
Write-Host "SELESAI. $jumlah file backup ada di $data" -ForegroundColor Green
Write-Host "Catatan tiap malam: $folder\log.txt"
Write-Host "Mencopot: hapus tugas '$TUGAS' di Task Scheduler, lalu hapus folder $folder."
