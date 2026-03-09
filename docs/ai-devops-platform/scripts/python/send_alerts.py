#!/usr/bin/env python3
"""
Security Alert Notification System

Sends security alerts via multiple channels (GitHub, Email, Slack)
with rate limiting, deduplication, and template-based formatting.

Usage:
    python send_alerts.py --severity critical --details '{"pattern": "x"}' --repo owner/repo
    python send_alerts.py --config config.json --input alerts.json
"""

import argparse
import hashlib
import json
import os
import smtplib
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class AlertConfig:
    severity: str
    repository: str
    threat_details: Dict[str, Any]
    issue_number: Optional[int] = None
    branch_name: Optional[str] = None
    session_id: Optional[str] = None


@dataclass
class NotificationResult:
    channel: str
    success: bool
    error: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TemplateManager:
    def __init__(self, template_path: Optional[Path] = None):
        self.template_path = template_path or Path(__file__).parent.parent / "config" / "notification-templates.json"
        self.templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, Any]:
        if self.template_path.exists():
            with open(self.template_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._default_templates()
    
    def _default_templates(self) -> Dict[str, Any]:
        return {
            "templates": {
                "github_comment": {
                    "critical": {"header": "CRITICAL Security Alert", "emoji": ":rotating_light:"},
                    "high": {"header": "HIGH Security Alert", "emoji": ":warning:"},
                    "medium": {"header": "Security Warning", "emoji": ":information_source:"},
                    "low": {"header": "Security Notice", "emoji": ":memo:"}
                },
                "slack": {
                    "severity_config": {
                        "critical": {"color": "danger", "emoji": ":rotating_light:"},
                        "high": {"color": "warning", "emoji": ":warning:"},
                        "medium": {"color": "good", "emoji": ":information_source:"},
                        "low": {"color": "#808080", "emoji": ":memo:"}
                    }
                }
            }
        }
    
    def get_github_template(self, severity: str) -> Dict[str, str]:
        return self.templates["templates"]["github_comment"].get(severity.lower(), 
                   self.templates["templates"]["github_comment"]["medium"])
    
    def get_slack_config(self, severity: str) -> Dict[str, str]:
        return self.templates["templates"]["slack"]["severity_config"].get(severity.lower(),
                   self.templates["templates"]["slack"]["severity_config"]["medium"])
    
    def get_email_subject(self, severity: str, repository: str) -> str:
        subjects = self.templates["templates"]["email"]["subjects"]
        subject_template = subjects.get(severity.lower(), subjects["medium"])
        return f"{subject_template} - {repository}"


class RateLimiter:
    def __init__(self, config: Dict[str, Any]):
        self.enabled = config.get("enabled", True)
        self.window_seconds = config.get("window_seconds", 60)
        self.max_notifications = config.get("max_notifications", {})
        self.aggregation = config.get("aggregation", {})
        self._notification_history: Dict[str, List[float]] = {}
    
    def is_allowed(self, severity: str) -> bool:
        if not self.enabled:
            return True
        
        key = severity.lower()
        now = time.time()
        
        if key not in self._notification_history:
            self._notification_history[key] = []
        
        self._notification_history[key] = [
            ts for ts in self._notification_history[key]
            if now - ts < self.window_seconds
        ]
        
        max_allowed = self.max_notifications.get(key, 5)
        if len(self._notification_history[key]) >= max_allowed:
            return False
        
        self._notification_history[key].append(now)
        return True


class DeduplicationService:
    def __init__(self, config: Dict[str, Any]):
        self.enabled = config.get("enabled", True)
        self.hash_fields = config.get("hash_fields", ["pattern", "source", "repository"])
        self.ttl_seconds = config.get("ttl_seconds", 3600)
        self._seen_hashes: Dict[str, float] = {}
    
    def _compute_hash(self, alert: AlertConfig) -> str:
        hash_data = {}
        for field in self.hash_fields:
            if field == "repository":
                hash_data[field] = alert.repository
            elif field in alert.threat_details:
                hash_data[field] = alert.threat_details[field]
        
        hash_str = json.dumps(hash_data, sort_keys=True)
        return hashlib.sha256(hash_str.encode()).hexdigest()[:16]
    
    def is_duplicate(self, alert: AlertConfig) -> bool:
        if not self.enabled:
            return False
        
        alert_hash = self._compute_hash(alert)
        now = time.time()
        
        self._seen_hashes = {
            h: ts for h, ts in self._seen_hashes.items()
            if now - ts < self.ttl_seconds
        }
        
        if alert_hash in self._seen_hashes:
            return True
        
        self._seen_hashes[alert_hash] = now
        return False


class GitHubNotifier:
    def __init__(self, token: str, template_manager: TemplateManager):
        self.token = token
        self.template_manager = template_manager
        self.api_base = "https://api.github.com"
    
    def send(self, alert: AlertConfig) -> NotificationResult:
        if not alert.issue_number:
            return NotificationResult(
                channel="github",
                success=False,
                error="No issue number provided"
            )
        
        try:
            template = self.template_manager.get_github_template(alert.severity)
            body = self._format_comment(alert, template)
            
            url = f"{self.api_base}/repos/{alert.repository}/issues/{alert.issue_number}/comments"
            data = json.dumps({"body": body}).encode('utf-8')
            
            req = urllib.request.Request(url, data=data, method='POST')
            req.add_header('Authorization', f'token {self.token}')
            req.add_header('Accept', 'application/vnd.github.v3+json')
            req.add_header('Content-Type', 'application/json')
            
            with urllib.request.urlopen(req, timeout=30) as response:
                if response.status in (200, 201):
                    return NotificationResult(channel="github", success=True)
                else:
                    return NotificationResult(
                        channel="github",
                        success=False,
                        error=f"HTTP {response.status}"
                    )
        except Exception as e:
            return NotificationResult(channel="github", success=False, error=str(e))
    
    def _format_comment(self, alert: AlertConfig, template: Dict[str, str]) -> str:
        emoji = template.get("emoji", ":warning:")
        header = template.get("header", "Security Alert")
        
        lines = [
            f"{emoji} **{header}**",
            "",
            "---",
            "",
            f"**Severity:** {alert.severity.upper()}",
            f"**Repository:** {alert.repository}",
        ]
        
        if alert.threat_details:
            lines.append("")
            lines.append("**Threat Details:**")
            for key, value in alert.threat_details.items():
                lines.append(f"- **{key}:** {value}")
        
        if alert.branch_name:
            lines.append(f"**Branch Terminated:** `{alert.branch_name}`")
        
        if alert.session_id:
            lines.append(f"**Session ID:** `{alert.session_id}`")
        
        lines.extend([
            "",
            "---",
            "",
            "**Action Taken:** Session terminated",
            "**Next Steps:** Manual review required",
            "",
            "_This is an automated security notification from AI-DevOps Platform_"
        ])
        
        return "\n".join(lines)


class EmailNotifier:
    def __init__(self, config: Dict[str, str], template_manager: TemplateManager):
        self.config = config
        self.template_manager = template_manager
        self.enabled = config.get('enabled', 'false').lower() == 'true'
    
    def send(self, alert: AlertConfig) -> NotificationResult:
        if not self.enabled:
            return NotificationResult(
                channel="email",
                success=False,
                error="Email notifications disabled"
            )
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = self.template_manager.get_email_subject(
                alert.severity, alert.repository
            )
            msg['From'] = self.config.get('sender', 'security@ai-devops.local')
            msg['To'] = self.config.get('recipients', '')
            
            text_body = self._format_text_body(alert)
            html_body = self._format_html_body(alert)
            
            msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            smtp_server = self.config.get('smtp_server', 'localhost')
            smtp_port = int(self.config.get('smtp_port', '25'))
            
            with smtplib.SMTP(smtp_server, smtp_port, timeout=30) as server:
                username = self.config.get('username')
                if username:
                    server.starttls()
                    server.login(username, self.config.get('password', ''))
                
                server.send_message(msg)
            
            return NotificationResult(channel="email", success=True)
        except Exception as e:
            return NotificationResult(channel="email", success=False, error=str(e))
    
    def _format_text_body(self, alert: AlertConfig) -> str:
        lines = [
            "SECURITY ALERT NOTIFICATION",
            "=" * 40,
            "",
            f"Severity: {alert.severity.upper()}",
            f"Repository: {alert.repository}",
            f"Timestamp: {datetime.now(timezone.utc).isoformat()}",
            "",
            "THREAT DETAILS:",
            "-" * 20,
        ]
        
        for key, value in alert.threat_details.items():
            lines.append(f"  {key}: {value}")
        
        lines.extend([
            "",
            "ACTIONS TAKEN:",
            "-" * 20,
            "  - Session terminated",
            "  - Branch isolated" if alert.branch_name else "",
            "",
            "This is an automated notification.",
            "Do not reply to this email."
        ])
        
        return "\n".join(lines)
    
    def _format_html_body(self, alert: AlertConfig) -> str:
        severity_colors = {
            "critical": "#dc3545",
            "high": "#fd7e14",
            "medium": "#ffc107",
            "low": "#6c757d"
        }
        color = severity_colors.get(alert.severity.lower(), "#6c757d")
        
        details_rows = ""
        for key, value in alert.threat_details.items():
            details_rows += f"<tr><td><strong>{key}</strong></td><td>{value}</td></tr>"
        
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: {color}; color: white; padding: 15px; border-radius: 5px;">
                    <h1 style="margin: 0;">{alert.severity.upper()} Security Alert</h1>
                </div>
                <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                    <p><strong>Repository:</strong> {alert.repository}</p>
                    <p><strong>Timestamp:</strong> {datetime.now(timezone.utc).isoformat()}</p>
                    
                    <h2>Threat Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        {details_rows}
                    </table>
                    
                    <h2>Actions Taken</h2>
                    <ul>
                        <li>Session terminated</li>
                        {f'<li>Branch isolated: {alert.branch_name}</li>' if alert.branch_name else ''}
                    </ul>
                </div>
                <p style="color: #666; font-size: 12px;">
                    This is an automated notification from AI-DevOps Platform.
                </p>
            </div>
        </body>
        </html>
        """


class SlackNotifier:
    def __init__(self, webhook_url: str, template_manager: TemplateManager):
        self.webhook_url = webhook_url
        self.template_manager = template_manager
    
    def send(self, alert: AlertConfig) -> NotificationResult:
        if not self.webhook_url:
            return NotificationResult(
                channel="slack",
                success=False,
                error="No webhook URL configured"
            )
        
        try:
            config = self.template_manager.get_slack_config(alert.severity)
            payload = self._build_payload(alert, config)
            
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                self.webhook_url,
                data=data,
                method='POST'
            )
            req.add_header('Content-Type', 'application/json')
            
            with urllib.request.urlopen(req, timeout=30) as response:
                if response.status == 200:
                    return NotificationResult(channel="slack", success=True)
                else:
                    return NotificationResult(
                        channel="slack",
                        success=False,
                        error=f"HTTP {response.status}"
                    )
        except Exception as e:
            return NotificationResult(channel="slack", success=False, error=str(e))
    
    def _build_payload(self, alert: AlertConfig, config: Dict[str, str]) -> Dict[str, Any]:
        fields = [
            {
                "type": "mrkdwn",
                "text": f"*Repository:*\n{alert.repository}"
            },
            {
                "type": "mrkdwn",
                "text": f"*Severity:*\n{alert.severity.upper()}"
            }
        ]
        
        if alert.branch_name:
            fields.append({
                "type": "mrkdwn",
                "text": f"*Branch:*\n`{alert.branch_name}`"
            })
        
        if alert.session_id:
            fields.append({
                "type": "mrkdwn",
                "text": f"*Session:*\n`{alert.session_id}`"
            })
        
        details_text = ""
        if alert.threat_details:
            for key, value in list(alert.threat_details.items())[:3]:
                details_text += f"• *{key}:* {value}\n"
        
        return {
            "text": f"{config['emoji']} Security Alert - {alert.severity.upper()}",
            "attachments": [
                {
                    "color": config['color'],
                    "blocks": [
                        {
                            "type": "header",
                            "text": {
                                "type": "plain_text",
                                "text": f"{config['emoji']} {alert.severity.upper()} Security Alert",
                                "emoji": True
                            }
                        },
                        {
                            "type": "section",
                            "fields": fields
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": details_text
                            }
                        } if details_text else None,
                        {
                            "type": "context",
                            "elements": [
                                {
                                    "type": "mrkdwn",
                                    "text": f"AI-DevOps Platform | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC"
                                }
                            ]
                        }
                    ]
                }
            ]
        }


class AlertNotificationService:
    def __init__(self, config_path: Optional[Path] = None):
        self.template_manager = TemplateManager(
            config_path.parent / "notification-templates.json" if config_path else None
        )
        self.config = self._load_config(config_path)
        self.rate_limiter = RateLimiter(self.config.get("rate_limiting", {}))
        self.dedup_service = DeduplicationService(self.config.get("deduplication", {}))
        
        self._init_notifiers()
    
    def _load_config(self, config_path: Optional[Path]) -> Dict[str, Any]:
        if config_path and config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self.config if hasattr(self, 'config') else {}
    
    def _init_notifiers(self):
        self.github_notifier = GitHubNotifier(
            os.environ.get('GITHUB_TOKEN', ''),
            self.template_manager
        )
        
        self.email_notifier = EmailNotifier(
            {
                'enabled': os.environ.get('SECURITY_EMAIL_ENABLED', 'false'),
                'recipients': os.environ.get('SECURITY_EMAIL_RECIPIENTS', ''),
                'smtp_server': os.environ.get('SECURITY_EMAIL_SMTP_SERVER', 'localhost'),
                'smtp_port': os.environ.get('SECURITY_EMAIL_SMTP_PORT', '25'),
                'username': os.environ.get('SECURITY_EMAIL_USERNAME', ''),
                'password': os.environ.get('SECURITY_EMAIL_PASSWORD', ''),
                'sender': os.environ.get('SECURITY_EMAIL_SENDER', 'security@ai-devops.local')
            },
            self.template_manager
        )
        
        self.slack_notifier = SlackNotifier(
            os.environ.get('SLACK_SECURITY_WEBHOOK', ''),
            self.template_manager
        )
    
    def send_alert(self, alert: AlertConfig) -> Dict[str, Any]:
        results = {
            "alert_id": hashlib.sha256(
                f"{alert.repository}:{alert.severity}:{time.time()}".encode()
            ).hexdigest()[:16],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": alert.severity,
            "repository": alert.repository,
            "notifications": [],
            "summary": {
                "total": 0,
                "successful": 0,
                "failed": 0,
                "skipped": 0
            }
        }
        
        if self.dedup_service.is_duplicate(alert):
            results["deduplicated"] = True
            results["summary"]["skipped"] = 1
            return results
        
        if not self.rate_limiter.is_allowed(alert.severity):
            results["rate_limited"] = True
            results["summary"]["skipped"] = 1
            return results
        
        routing_rules = self.config.get("routing_rules", self._default_routing_rules())
        channels = self._get_channels_for_severity(alert.severity, routing_rules)
        
        for channel in channels:
            result = self._send_to_channel(channel, alert)
            results["notifications"].append({
                "channel": result.channel,
                "success": result.success,
                "error": result.error,
                "timestamp": result.timestamp
            })
            
            results["summary"]["total"] += 1
            if result.success:
                results["summary"]["successful"] += 1
            elif result.error:
                results["summary"]["failed"] += 1
            else:
                results["summary"]["skipped"] += 1
        
        return results
    
    def _default_routing_rules(self) -> List[Dict[str, Any]]:
        return [
            {"severity": ["critical"], "channels": ["github", "email", "slack"]},
            {"severity": ["high"], "channels": ["github", "slack"]},
            {"severity": ["medium"], "channels": ["github", "slack"]},
            {"severity": ["low"], "channels": ["github"]}
        ]
    
    def _get_channels_for_severity(
        self, 
        severity: str, 
        routing_rules: List[Dict[str, Any]]
    ) -> List[str]:
        for rule in routing_rules:
            if severity.lower() in [s.lower() for s in rule.get("severity", [])]:
                return rule.get("channels", ["github"])
        return ["github"]
    
    def _send_to_channel(self, channel: str, alert: AlertConfig) -> NotificationResult:
        notifiers = {
            "github": self.github_notifier,
            "email": self.email_notifier,
            "slack": self.slack_notifier
        }
        
        notifier = notifiers.get(channel)
        if notifier:
            return notifier.send(alert)
        
        return NotificationResult(
            channel=channel,
            success=False,
            error=f"Unknown channel: {channel}"
        )


def main():
    parser = argparse.ArgumentParser(
        description='Send security alert notifications'
    )
    parser.add_argument(
        '--severity',
        required=True,
        choices=['critical', 'high', 'medium', 'low'],
        help='Alert severity level'
    )
    parser.add_argument(
        '--details',
        required=True,
        help='JSON threat details'
    )
    parser.add_argument(
        '--repo',
        required=True,
        help='Target repository (owner/repo)'
    )
    parser.add_argument(
        '--issue-number',
        type=int,
        help='Related issue/PR number'
    )
    parser.add_argument(
        '--branch-name',
        help='Branch name that was terminated'
    )
    parser.add_argument(
        '--session-id',
        help='Session identifier'
    )
    parser.add_argument(
        '--config',
        type=Path,
        help='Path to configuration file'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print notifications without sending'
    )
    
    args = parser.parse_args()
    
    try:
        threat_details = json.loads(args.details)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in --details: {e}", file=sys.stderr)
        sys.exit(1)
    
    alert = AlertConfig(
        severity=args.severity,
        repository=args.repo,
        threat_details=threat_details,
        issue_number=args.issue_number,
        branch_name=args.branch_name,
        session_id=args.session_id
    )
    
    if args.dry_run:
        print("=== DRY RUN MODE ===")
        print(f"Severity: {alert.severity}")
        print(f"Repository: {alert.repository}")
        print(f"Details: {json.dumps(alert.threat_details, indent=2)}")
        sys.exit(0)
    
    service = AlertNotificationService(args.config)
    results = service.send_alert(alert)
    
    print(json.dumps(results, indent=2))
    
    if results["summary"]["failed"] > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
