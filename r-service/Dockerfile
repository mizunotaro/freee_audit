FROM rocker/r-ver:4.3.2

LABEL maintainer="Freee Audit Team"
LABEL description="R Statistical Analysis Service for Financial Data"
LABEL version="1.0.0"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libfontconfig1-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install R packages in layers for better caching
# Core packages
RUN R -e "install.packages(c('plumber', 'jsonlite', 'httr', 'logger'), \
    repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Data manipulation packages
RUN R -e "install.packages(c('dplyr', 'tidyr', 'purrr'), \
    repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Statistics packages
RUN R -e "install.packages(c('MASS', 'car'), \
    repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Time series packages
RUN R -e "install.packages(c('forecast', 'tseries', 'zoo', 'xts'), \
    repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Financial packages
RUN R -e "install.packages(c('PerformanceAnalytics', 'lmtest'), \
    repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Visualization packages
RUN R -e "install.packages(c('ggplot2', 'plotly'), \
    repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Additional statistical packages
RUN R -e "install.packages(c('nortest', 'Kendall', 'changepoint'), \
    repos='https://cloud.r-project.org/', dependencies=TRUE)"

# Copy application files
COPY R/ /app/R/
COPY plumber.R /app/
COPY tests/ /app/tests/

# Create log directory
RUN mkdir -p /app/logs

# Set environment variables
ENV R_ENVIRON_USER=/app/.Renviron
ENV LOG_LEVEL=INFO

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run application
CMD ["R", "-e", "pr <- plumber::plumb('plumber.R'); pr$run(host='0.0.0.0', port=8001, swagger=TRUE)"]
