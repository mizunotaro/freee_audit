# R Statistical Analysis Service - Windows 11 Setup Script (PowerShell)
# Run this script in PowerShell as Administrator

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "R Statistical Analysis Service Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator." -ForegroundColor Yellow
    Write-Host "Some installation steps may require elevated privileges." -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if a command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Method 1: Check if Chocolatey is installed
Write-Host "Step 1: Checking package manager..." -ForegroundColor Yellow
if (Test-Command "choco") {
    Write-Host "  [OK] Chocolatey is installed" -ForegroundColor Green
    $useChoco = $true
} else {
    Write-Host "  [INFO] Chocolatey not found" -ForegroundColor Yellow
    $installChoco = Read-Host "  Install Chocolatey? (Y/n)"
    if ($installChoco -ne "n" -and $installChoco -ne "N") {
        Write-Host "  Installing Chocolatey..." -ForegroundColor Yellow
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $useChoco = $true
    } else {
        $useChoco = $false
    }
}

# Method 2: Install R
Write-Host ""
Write-Host "Step 2: Installing R..." -ForegroundColor Yellow

if (Test-Command "Rscript") {
    Write-Host "  [OK] R is already installed" -ForegroundColor Green
    Rscript --version
} else {
    if ($useChoco) {
        Write-Host "  Installing R via Chocolatey..." -ForegroundColor Yellow
        choco install r.project -y
        Write-Host "  Installing Rtools via Chocolatey..." -ForegroundColor Yellow
        choco install rtools -y
    } else {
        Write-Host ""
        Write-Host "  Please install R manually:" -ForegroundColor Yellow
        Write-Host "  1. Download R from: https://cran.r-project.org/bin/windows/base/" -ForegroundColor White
        Write-Host "     Recommended: R-4.3.2 or higher" -ForegroundColor White
        Write-Host "  2. Run the installer" -ForegroundColor White
        Write-Host "  3. Download Rtools from: https://cran.r-project.org/bin/windows/Rtools/" -ForegroundColor White
        Write-Host "  4. Run the Rtools installer" -ForegroundColor White
        Write-Host ""
        Read-Host "  Press Enter after installing R to continue"
    }
}

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Verify R installation
Write-Host ""
Write-Host "Step 3: Verifying R installation..." -ForegroundColor Yellow
if (Test-Command "Rscript") {
    Write-Host "  [OK] R is available in PATH" -ForegroundColor Green
    Rscript --version
} else {
    Write-Host "  [ERROR] R is not in PATH. You may need to restart PowerShell or add R to PATH manually." -ForegroundColor Red
    Write-Host "  Typical R path: C:\Program Files\R\R-4.x.x\bin" -ForegroundColor Yellow
    exit 1
}

# Install R packages
Write-Host ""
Write-Host "Step 4: Installing R packages..." -ForegroundColor Yellow
Write-Host "  This may take several minutes..." -ForegroundColor Gray

$packagesScript = @'
packages <- c(
  "plumber", "jsonlite", "dplyr", "tidyr", "purrr",
  "ggplot2", "plotly", "httr", "logger", "forecast",
  "tseries", "zoo", "xts", "PerformanceAnalytics",
  "MASS", "car", "lmtest", "nortest", "Kendall",
  "changepoint", "testthat"
)

for (pkg in packages) {
  if (requireNamespace(pkg, quietly = TRUE)) {
    cat(paste0("[OK] ", pkg, "\n"))
  } else {
    cat(paste0("Installing ", pkg, "...\n"))
    install.packages(pkg, repos = "https://cloud.r-project.org/", quiet = TRUE)
  }
}
cat("\nAll packages installed!\n")
'@

$packagesScript | Out-File -FilePath "install_packages.R" -Encoding UTF8
Rscript install_packages.R
Remove-Item "install_packages.R"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the service:" -ForegroundColor Yellow
Write-Host "  cd r-service" -ForegroundColor White
Write-Host "  .\start_service.bat" -ForegroundColor White
Write-Host ""
Write-Host "Or manually:" -ForegroundColor Yellow
Write-Host '  Rscript -e "pr <- plumber::plumb(''plumber.R''); pr`$run(host=''0.0.0.0'', port=8001)"' -ForegroundColor White
Write-Host ""
Write-Host "API will be available at: http://localhost:8001" -ForegroundColor Green
Write-Host "Swagger UI: http://localhost:8001/__swagger__/" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
