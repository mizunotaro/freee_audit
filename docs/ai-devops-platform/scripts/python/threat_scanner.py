#!/usr/bin/env python3
"""
Threat Scanner for AI Sessions

Scans changed files for potential security threats and anomalies.
Outputs results in JSON format for workflow consumption.
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Threat:
    severity: str
    pattern: str
    file: str
    line: int
    description: str
    match: str


CRITICAL_PATTERNS = [
    {
        "pattern": r"-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----",
        "description": "Private key exposed"
    },
    {
        "pattern": r"(?i)api[_-]?key\s*=\s*['\"][^'\"]{20,}['\"]",
        "description": "API key hardcoded"
    },
    {
        "pattern": r"(?i)aws[_-]?secret[_-]?access[_-]?key\s*=\s*['\"][^'\"]+['\"]",
        "description": "AWS secret key exposed"
    },
    {
        "pattern": r"(?i)password\s*=\s*['\"][^'\"]+['\"]",
        "description": "Password hardcoded"
    },
    {
        "pattern": r"(?i)(eval|exec|system)\s*\(\s*[^)]*\$\{",
        "description": "Code injection vulnerability"
    },
    {
        "pattern": r"(?i)rm\s+-rf\s+/",
        "description": "Destructive command"
    },
    {
        "pattern": r"(?i)DROP\s+TABLE\s+",
        "description": "SQL injection attempt"
    },
]

HIGH_PATTERNS = [
    {
        "pattern": r"(?i)Authorization:\s*Bearer\s+[A-Za-z0-9_-]{20,}",
        "description": "Bearer token exposed"
    },
    {
        "pattern": r"(?i)token\s*=\s*['\"][^'\"]{20,}['\"]",
        "description": "Token hardcoded"
    },
    {
        "pattern": r"(?i)curl\s+.*-H\s+.*Authorization",
        "description": "Authorization header in curl"
    },
    {
        "pattern": r"(?i)\.env\b",
        "description": "Environment file reference"
    },
    {
        "pattern": r"(?i)secret[_-]?key\s*=\s*['\"][^'\"]+['\"]",
        "description": "Secret key hardcoded"
    },
    {
        "pattern": r"(?i)base64\s*-d\s*\|",
        "description": "Base64 decode and execute"
    },
]

MEDIUM_PATTERNS = [
    {
        "pattern": r"(?i)TODO.*security",
        "description": "Security TODO item"
    },
    {
        "pattern": r"(?i)FIXME.*auth",
        "description": "Authentication fixme"
    },
    {
        "pattern": r"(?i)debug\s*=\s*true",
        "description": "Debug mode enabled"
    },
    {
        "pattern": r"(?i)console\.log\([^)]*password",
        "description": "Password logging"
    },
    {
        "pattern": r"(?i)localhost:\d+",
        "description": "Localhost reference"
    },
]

LOW_PATTERNS = [
    {
        "pattern": r"(?i)deprecated",
        "description": "Deprecated code"
    },
    {
        "pattern": r"(?i)hack",
        "description": "Hack keyword"
    },
    {
        "pattern": r"(?i)workaround",
        "description": "Workaround present"
    },
]


def find_line_number(content: str, pattern: str) -> int:
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        if re.search(pattern, line):
            return i
    return 1


def get_match_context(content: str, pattern: str, max_length: int = 100) -> str:
    match = re.search(pattern, content)
    if match:
        matched_text = match.group(0)
        if len(matched_text) > max_length:
            return matched_text[:max_length] + "..."
        return matched_text
    return ""


def scan_file(filepath: str, content: str) -> List[Threat]:
    threats = []
    
    for pattern_info in CRITICAL_PATTERNS:
        pattern = pattern_info["pattern"]
        if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
            threats.append(Threat(
                severity=Severity.CRITICAL.value,
                pattern=pattern,
                file=filepath,
                line=find_line_number(content, pattern),
                description=pattern_info["description"],
                match=get_match_context(content, pattern)
            ))
    
    for pattern_info in HIGH_PATTERNS:
        pattern = pattern_info["pattern"]
        if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
            threats.append(Threat(
                severity=Severity.HIGH.value,
                pattern=pattern,
                file=filepath,
                line=find_line_number(content, pattern),
                description=pattern_info["description"],
                match=get_match_context(content, pattern)
            ))
    
    for pattern_info in MEDIUM_PATTERNS:
        pattern = pattern_info["pattern"]
        if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
            threats.append(Threat(
                severity=Severity.MEDIUM.value,
                pattern=pattern,
                file=filepath,
                line=find_line_number(content, pattern),
                description=pattern_info["description"],
                match=get_match_context(content, pattern)
            ))
    
    for pattern_info in LOW_PATTERNS:
        pattern = pattern_info["pattern"]
        if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
            threats.append(Threat(
                severity=Severity.LOW.value,
                pattern=pattern,
                file=filepath,
                line=find_line_number(content, pattern),
                description=pattern_info["description"],
                match=get_match_context(content, pattern)
            ))
    
    return threats


def scan_directory(directory: str, extensions: Optional[List[str]] = None) -> List[Threat]:
    if extensions is None:
        extensions = ['.py', '.js', '.ts', '.yml', '.yaml', '.json', '.env', '.sh', '.md']
    
    all_threats = []
    path = Path(directory)
    
    if not path.exists():
        print(f"Error: Directory {directory} does not exist", file=sys.stderr)
        return all_threats
    
    for ext in extensions:
        for file_path in path.rglob(f'*{ext}'):
            if '.git' in str(file_path) or 'node_modules' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                threats = scan_file(str(file_path), content)
                all_threats.extend(threats)
            except Exception as e:
                print(f"Warning: Could not scan {file_path}: {e}", file=sys.stderr)
    
    return all_threats


def scan_changed_files(files: List[str]) -> List[Threat]:
    all_threats = []
    
    for filepath in files:
        if not os.path.exists(filepath):
            continue
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            threats = scan_file(filepath, content)
            all_threats.extend(threats)
        except Exception as e:
            print(f"Warning: Could not scan {filepath}: {e}", file=sys.stderr)
    
    return all_threats


def calculate_severity_summary(threats: List[Threat]) -> Dict[str, int]:
    summary = {
        Severity.CRITICAL.value: 0,
        Severity.HIGH.value: 0,
        Severity.MEDIUM.value: 0,
        Severity.LOW.value: 0,
        Severity.INFO.value: 0
    }
    
    for threat in threats:
        summary[threat.severity] = summary.get(threat.severity, 0) + 1
    
    return summary


def should_block(threats: List[Threat]) -> bool:
    for threat in threats:
        if threat.severity in [Severity.CRITICAL.value, Severity.HIGH.value]:
            return True
    return False


def main():
    parser = argparse.ArgumentParser(description='Scan files for security threats')
    parser.add_argument('--directory', '-d', help='Directory to scan')
    parser.add_argument('--files', '-f', nargs='+', help='Specific files to scan')
    parser.add_argument('--output', '-o', default='json', choices=['json', 'text'],
                        help='Output format')
    parser.add_argument('--exit-code', action='store_true',
                        help='Exit with non-zero code if threats found')
    parser.add_argument('--extensions', nargs='+',
                        help='File extensions to scan')
    
    args = parser.parse_args()
    
    threats = []
    
    if args.files:
        threats = scan_changed_files(args.files)
    elif args.directory:
        threats = scan_directory(args.directory, args.extensions)
    else:
        threats = scan_directory('.', args.extensions)
    
    summary = calculate_severity_summary(threats)
    block = should_block(threats)
    
    result = {
        "threats_found": len(threats) > 0,
        "should_block": block,
        "threat_count": len(threats),
        "severity_summary": summary,
        "threats": [asdict(t) for t in threats]
    }
    
    if args.output == 'json':
        print(json.dumps(result, indent=2))
    else:
        print(f"Threat Scan Results")
        print(f"===================")
        print(f"Total threats: {len(threats)}")
        print(f"Should block: {block}")
        print(f"\nSeverity Summary:")
        for severity, count in summary.items():
            if count > 0:
                print(f"  {severity.upper()}: {count}")
        
        if threats:
            print(f"\nDetailed Threats:")
            for threat in threats:
                print(f"  [{threat.severity.upper()}] {threat.file}:{threat.line}")
                print(f"    {threat.description}")
                print(f"    Match: {threat.match}")
    
    if args.exit_code and block:
        sys.exit(1)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
