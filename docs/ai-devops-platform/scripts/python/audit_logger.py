#!/usr/bin/env python3
"""
Security Audit Logger System
Records all security events and provides querying/reporting capabilities.
"""

import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from pathlib import Path
from enum import Enum
from dataclasses import dataclass, asdict
import subprocess


class EventType(str, Enum):
    SESSION_START = "SESSION_START"
    SESSION_END = "SESSION_END"
    FILE_CHANGE = "FILE_CHANGE"
    THREAT_DETECTED = "THREAT_DETECTED"
    SESSION_TERMINATED = "SESSION_TERMINATED"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class Severity(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    event_id: str
    timestamp: str
    event_type: str
    severity: str
    session_id: Optional[str]
    repository: Optional[str]
    issue_number: Optional[int]
    branch: Optional[str]
    details: Dict[str, Any]
    action_taken: Optional[str]
    actor: str

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class AuditReport:
    report_id: str
    generated_at: str
    period_start: str
    period_end: str
    total_events: int
    events_by_type: Dict[str, int]
    events_by_severity: Dict[str, int]
    critical_events: List[Dict[str, Any]]
    summary: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AuditLogger:
    EVENT_TYPES = EventType
    SEVERITY_LEVELS = Severity

    def __init__(self, log_path: str = "audit.log", artifacts_dir: str = "audit-artifacts"):
        self.log_path = Path(log_path)
        self.artifacts_dir = Path(artifacts_dir)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

    def log_event(
        self,
        event_type: EventType,
        severity: Severity,
        details: Dict[str, Any],
        session_id: Optional[str] = None,
        repository: Optional[str] = None,
        issue_number: Optional[int] = None,
        branch: Optional[str] = None,
        action_taken: Optional[str] = None,
        actor: str = "system"
    ) -> str:
        event_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        event = AuditEvent(
            event_id=event_id,
            timestamp=timestamp,
            event_type=event_type.value,
            severity=severity.value,
            session_id=session_id,
            repository=repository,
            issue_number=issue_number,
            branch=branch,
            details=details,
            action_taken=action_taken,
            actor=actor
        )

        self._write_event(event)
        self._upload_to_artifacts(event)

        if severity == Severity.CRITICAL:
            self._handle_critical_event(event)

        return event_id

    def _write_event(self, event: AuditEvent) -> None:
        with open(self.log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event.to_dict(), ensure_ascii=False) + '\n')

    def _upload_to_artifacts(self, event: AuditEvent) -> None:
        date_prefix = datetime.utcnow().strftime('%Y-%m-%d')
        artifact_file = self.artifacts_dir / f"audit-{date_prefix}.jsonl"

        with open(artifact_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event.to_dict(), ensure_ascii=False) + '\n')

        if os.environ.get('GITHUB_ACTIONS') == 'true':
            self._upload_github_artifact(artifact_file)

    def _upload_github_artifact(self, artifact_file: Path) -> None:
        try:
            subprocess.run([
                'gh', 'run', 'upload',
                '--name', f"audit-logs-{datetime.utcnow().strftime('%Y%m%d')}",
                str(artifact_file)
            ], check=True, capture_output=True, text=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

    def _handle_critical_event(self, event: AuditEvent) -> None:
        critical_file = self.artifacts_dir / "critical-events.jsonl"
        with open(critical_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event.to_dict(), ensure_ascii=False) + '\n')

    def query_events(
        self,
        event_type: Optional[EventType] = None,
        severity: Optional[Severity] = None,
        session_id: Optional[str] = None,
        repository: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        if not self.log_path.exists():
            return []

        results = []

        with open(self.log_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if self._matches_filters(
                    event, event_type, severity, session_id,
                    repository, start_time, end_time
                ):
                    results.append(event)

                    if len(results) >= limit:
                        break

        return results

    def _matches_filters(
        self,
        event: Dict[str, Any],
        event_type: Optional[EventType],
        severity: Optional[Severity],
        session_id: Optional[str],
        repository: Optional[str],
        start_time: Optional[datetime],
        end_time: Optional[datetime]
    ) -> bool:
        if event_type and event.get('event_type') != event_type.value:
            return False

        if severity and event.get('severity') != severity.value:
            return False

        if session_id and event.get('session_id') != session_id:
            return False

        if repository and event.get('repository') != repository:
            return False

        if start_time or end_time:
            event_time = datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))

            if start_time and event_time < start_time.replace(tzinfo=event_time.tzinfo):
                return False

            if end_time and event_time > end_time.replace(tzinfo=event_time.tzinfo):
                return False

        return True

    def generate_report(
        self,
        start_time: datetime,
        end_time: datetime,
        include_critical_details: bool = True
    ) -> AuditReport:
        events = self.query_events(start_time=start_time, end_time=end_time, limit=10000)

        events_by_type: Dict[str, int] = {}
        events_by_severity: Dict[str, int] = {}
        critical_events: List[Dict[str, Any]] = []

        for event in events:
            event_type = event.get('event_type', 'UNKNOWN')
            events_by_type[event_type] = events_by_type.get(event_type, 0) + 1

            severity = event.get('severity', 'unknown')
            events_by_severity[severity] = events_by_severity.get(severity, 0) + 1

            if severity == 'critical':
                if include_critical_details:
                    critical_events.append({
                        'event_id': event.get('event_id'),
                        'timestamp': event.get('timestamp'),
                        'event_type': event.get('event_type'),
                        'details': event.get('details'),
                        'action_taken': event.get('action_taken')
                    })
                else:
                    critical_events.append({
                        'event_id': event.get('event_id'),
                        'timestamp': event.get('timestamp'),
                        'event_type': event.get('event_type')
                    })

        summary = self._generate_summary(
            len(events), events_by_type, events_by_severity, len(critical_events)
        )

        return AuditReport(
            report_id=str(uuid.uuid4()),
            generated_at=datetime.utcnow().isoformat() + "Z",
            period_start=start_time.isoformat(),
            period_end=end_time.isoformat(),
            total_events=len(events),
            events_by_type=events_by_type,
            events_by_severity=events_by_severity,
            critical_events=critical_events,
            summary=summary
        )

    def _generate_summary(
        self,
        total_events: int,
        events_by_type: Dict[str, int],
        events_by_severity: Dict[str, int],
        critical_count: int
    ) -> str:
        parts = [f"Total events: {total_events}"]

        if critical_count > 0:
            parts.append(f"Critical events: {critical_count}")

        if events_by_type:
            type_summary = ", ".join(f"{k}: {v}" for k, v in sorted(events_by_type.items()))
            parts.append(f"By type: {type_summary}")

        if events_by_severity:
            sev_summary = ", ".join(f"{k}: {v}" for k, v in sorted(events_by_severity.items()))
            parts.append(f"By severity: {sev_summary}")

        return " | ".join(parts)

    def save_report(self, report: AuditReport, output_path: Optional[str] = None) -> str:
        if output_path is None:
            output_path = str(self.artifacts_dir / f"report-{report.report_id}.json")

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)

        return output_path

    def get_session_timeline(self, session_id: str) -> List[Dict[str, Any]]:
        return self.query_events(session_id=session_id, limit=10000)

    def get_threat_summary(self, days: int = 7) -> Dict[str, Any]:
        start_time = datetime.utcnow() - timedelta(days=days)
        events = self.query_events(
            event_type=EventType.THREAT_DETECTED,
            start_time=start_time,
            limit=10000
        )

        threat_types: Dict[str, int] = {}
        repositories: Dict[str, int] = {}

        for event in events:
            details = event.get('details', {})
            threat_type = details.get('threat_type', 'unknown')
            threat_types[threat_type] = threat_types.get(threat_type, 0) + 1

            repo = event.get('repository', 'unknown')
            repositories[repo] = repositories.get(repo, 0) + 1

        return {
            'period_days': days,
            'total_threats': len(events),
            'threat_types': threat_types,
            'affected_repositories': repositories
        }


def create_logger_from_env() -> AuditLogger:
    log_path = os.environ.get('AUDIT_LOG_PATH', 'audit.log')
    artifacts_dir = os.environ.get('AUDIT_ARTIFACTS_DIR', 'audit-artifacts')
    return AuditLogger(log_path=log_path, artifacts_dir=artifacts_dir)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Security Audit Logger')
    parser.add_argument('--log-path', default='audit.log', help='Path to audit log file')
    parser.add_argument('--artifacts-dir', default='audit-artifacts', help='Path to artifacts directory')
    parser.add_argument('--report', action='store_true', help='Generate daily report')
    parser.add_argument('--threat-summary', action='store_true', help='Generate threat summary')
    parser.add_argument('--days', type=int, default=1, help='Number of days for report')

    args = parser.parse_args()

    logger = AuditLogger(log_path=args.log_path, artifacts_dir=args.artifacts_dir)

    if args.report:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=args.days)
        report = logger.generate_report(start_time, end_time)
        output_path = logger.save_report(report)
        print(f"Report saved to: {output_path}")
        print(f"Summary: {report.summary}")

    if args.threat_summary:
        summary = logger.get_threat_summary(days=args.days)
        print(json.dumps(summary, indent=2))
