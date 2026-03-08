#!/usr/bin/env bash
# Input Sanitization Library for AI-DevOps-Platform
# Security: Prevents injection attacks, path traversal, and malicious input

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly MAX_INPUT_LENGTH=65536
readonly MAX_PATH_LENGTH=4096

forbidden_patterns=(
    # Command injection
    ';\s*rm\s'
    ';\s*eval\s'
    ';\s*exec\s'
    '\$\('
    '`'
    '\|\s*sh\s'
    '\|\s*bash\s'
    '\|\s*zsh\s'
    
    # Path traversal
    '\.\.\/'
    '\.\.\\'
    
    # Dangerous file operations
    '>\s*/dev/'
    '>\s*/etc/'
    '>\s*/sys/'
    
    # AWS/Cloud credential patterns
    'AKIA[0-9A-Z]{16}'
    'aws_access_key_id'
    'aws_secret_access_key'
    
    # Private key patterns
    '-----BEGIN\s+.*PRIVATE\s+KEY-----'
    '-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----'
    
    # Database connection strings
    'mysql://[^[:space:]]+:[^[:space:]]+@'
    'postgres://[^[:space:]]+:[^[:space:]]+@'
    'mongodb://[^[:space:]]+:[^[:space:]]+@'
    
    # JWT tokens
    'eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*'
    
    # Slack/Discord webhooks
    'hooks\.slack\.com/services/T[0-9A-Z]+/B[0-9A-Z]+/[a-zA-Z0-9]+'
    'discord\.com/api/webhooks/[0-9]+/[a-zA-Z0-9_-]+'
)

sanitize_basic() {
    local input="${1:-}"
    
    if [[ -z "${input}" ]]; then
        echo ""
        return 0
    fi
    
    if [[ ${#input} -gt ${MAX_INPUT_LENGTH} ]]; then
        echo "ERROR: Input exceeds maximum length (${MAX_INPUT_LENGTH})" >&2
        return 1
    fi
    
    local sanitized="${input}"
    
    for pattern in "${forbidden_patterns[@]}"; do
        if echo "${sanitized}" | grep -qE "${pattern}"; then
            echo "ERROR: Input contains forbidden pattern" >&2
            return 1
        fi
    done
    
    sanitized=$(echo "${sanitized}" | tr -d '\000-\031')
    
    echo "${sanitized}"
}

sanitize_path() {
    local path="${1:-}"
    
    if [[ -z "${path}" ]]; then
        echo ""
        return 0
    fi
    
    if [[ ${#path} -gt ${MAX_PATH_LENGTH} ]]; then
        echo "ERROR: Path exceeds maximum length (${MAX_PATH_LENGTH})" >&2
        return 1
    fi
    
    local sanitized
    sanitized=$(realpath -m "${path}" 2>/dev/null || echo "${path}")
    
    if [[ "${sanitized}" == *'..'* ]]; then
        echo "ERROR: Path traversal detected" >&2
        return 1
    fi
    
    if [[ "${sanitized}" =~ ^/etc/|^/sys/|^/proc/|^/dev/ ]]; then
        echo "ERROR: Access to system directories denied" >&2
        return 1
    fi
    
    echo "${sanitized}"
}

sanitize_github_input() {
    local input="${1:-}"
    local input_type="${2:-text}"
    
    local sanitized
    sanitized=$(sanitize_basic "${input}") || return 1
    
    case "${input_type}" in
        "issue_title")
            if [[ ${#sanitized} -gt 256 ]]; then
                echo "ERROR: Issue title exceeds 256 characters" >&2
                return 1
            fi
            ;;
        "issue_body")
            if [[ ${#sanitized} -gt 65536 ]]; then
                echo "ERROR: Issue body exceeds 65536 characters" >&2
                return 1
            fi
            ;;
        "label")
            if [[ ! "${sanitized}" =~ ^[a-zA-Z0-9_-]+$ ]]; then
                echo "ERROR: Invalid label format" >&2
                return 1
            fi
            ;;
        "branch_name")
            if [[ ! "${sanitized}" =~ ^[a-zA-Z0-9/_-]+$ ]]; then
                echo "ERROR: Invalid branch name format" >&2
                return 1
            fi
            ;;
        "commit_sha")
            if [[ ! "${sanitized}" =~ ^[a-f0-9]{40}$ ]]; then
                echo "ERROR: Invalid commit SHA format" >&2
                return 1
            fi
            ;;
        *)
            ;;
    esac
    
    echo "${sanitized}"
}

encode_base64_safe() {
    local input="${1:-}"
    
    if [[ -z "${input}" ]]; then
        echo ""
        return 0
    fi
    
    echo -n "${input}" | base64 -w 0
}

decode_base64_safe() {
    local encoded="${1:-}"
    
    if [[ -z "${encoded}" ]]; then
        echo ""
        return 0
    fi
    
    local decoded
    decoded=$(echo "${encoded}" | base64 -d 2>/dev/null) || {
        echo "ERROR: Invalid base64 encoding" >&2
        return 1
    }
    
    echo "${decoded}"
}

sanitize_json_string() {
    local input="${1:-}"
    
    local sanitized
    sanitized=$(sanitize_basic "${input}") || return 1
    
    sanitized="${sanitized//\\/\\\\}"
    sanitized="${sanitized//\"/\\\"}"
    sanitized="${sanitized//$'\n'/\\n}"
    sanitized="${sanitized//$'\r'/\\r}"
    sanitized="${sanitized//$'\t'/\\t}"
    
    echo "${sanitized}"
}

validate_env_var() {
    local var_name="${1:-}"
    local value="${2:-}"
    
    if [[ ! "${var_name}" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
        echo "ERROR: Invalid environment variable name: ${var_name}" >&2
        return 1
    fi
    
    if [[ "${var_name}" =~ (PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL) ]]; then
        if [[ ${#value} -lt 16 ]]; then
            echo "ERROR: Secret value too short (min 16 chars)" >&2
            return 1
        fi
    fi
    
    return 0
}

is_safe_command() {
    local cmd="${1:-}"
    
    local safe_commands=(
        "git" "gh" "npm" "pnpm" "yarn" "node" "npx"
        "tsc" "eslint" "prettier" "jest" "vitest"
        "cat" "ls" "mkdir" "cp" "mv" "rm" "touch"
        "grep" "sed" "awk" "head" "tail" "wc"
        "curl" "wget"
    )
    
    local base_cmd
    base_cmd=$(echo "${cmd}" | awk '{print $1}')
    
    for safe in "${safe_commands[@]}"; do
        if [[ "${base_cmd}" == "${safe}" ]]; then
            return 0
        fi
    done
    
    return 1
}

main() {
    local action="${1:-help}"
    local input="${2:-}"
    local type="${3:-text}"
    
    case "${action}" in
        "basic")
            sanitize_basic "${input}"
            ;;
        "path")
            sanitize_path "${input}"
            ;;
        "github")
            sanitize_github_input "${input}" "${type}"
            ;;
        "encode")
            encode_base64_safe "${input}"
            ;;
        "decode")
            decode_base64_safe "${input}"
            ;;
        "json")
            sanitize_json_string "${input}"
            ;;
        "validate-env")
            validate_env_var "${input}" "${type}"
            ;;
        "is-safe-cmd")
            is_safe_command "${input}" && echo "SAFE" || echo "UNSAFE"
            ;;
        "help"|*)
            cat <<EOF
Usage: sanitize-input.sh <action> [input] [type]

Actions:
  basic          Basic input sanitization
  path           Path sanitization (prevents traversal)
  github         GitHub-specific sanitization (type: issue_title|issue_body|label|branch_name|commit_sha)
  encode         Base64 encode
  decode         Base64 decode
  json           JSON string escaping
  validate-env   Validate environment variable (name value)
  is-safe-cmd    Check if command is safe

Examples:
  sanitize-input.sh basic "user input"
  sanitize-input.sh github "Issue title" issue_title
  sanitize-input.sh path "./src/file.ts"
  sanitize-input.sh encode "secret data"
EOF
            ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
