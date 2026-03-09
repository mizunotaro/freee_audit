#!/usr/bin/env python3
"""
Emergency Response System

Analyzes security incidents, determines impact, generates rollback plans,
and creates comprehensive incident reports.
"""

import os
import sys
import re
import json
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IncidentStatus(Enum):
    DETECTED = "detected"
    ANALYZING = "analyzing"
    CONTAINED = "contained"
    RESOLVING = "resolving"
    RESOLVED = "resolved"
    CLOSED = "closed"


@dataclass
class AffectedResource:
    resource_type: str
    resource_id: str
    resource_name: str
    impact_level: str
    recovery_action: str


@dataclass
class RollbackStep:
    step_number: int
    action: str
    command: str
    verification: str
    risk_level: str


@dataclass
class Evidence:
    evidence_type: str
    source: str
    timestamp: str
    content: str
    hash: Optional[str] = None


@dataclass
class IncidentReport:
    incident_id: str
    timestamp: str
    severity: str
    status: str
    summary: str
    threats: List[Dict[str, Any]]
    affected_resources: List[Dict[str, Any]]
    rollback_plan: List[Dict[str, Any]]
    evidence: List[Dict[str, Any]]
    recommendations: List[str]
    timeline: List[Dict[str, str]]


class EmergencyResponse:
    SEVERITY_WEIGHTS = {
        Severity.CRITICAL.value: 4,
        Severity.HIGH.value: 3,
        Severity.MEDIUM.value: 2,
        Severity.LOW.value: 1,
        Severity.INFO.value: 0
    }

    RECOVERY_ACTIONS = {
        "workflow": {
            "stop": "gh run cancel {id}",
            "verify": "gh run view {id} --json status"
        },
        "branch": {
            "delete": "git push origin --delete {name}",
            "restore": "git push origin {sha}:refs/heads/{name}",
            "verify": "gh api repos/{repo}/branches/{name}"
        },
        "issue": {
            "update_label": "gh issue edit {id} --add-label {label}",
            "comment": "gh issue comment {id} --body '{body}'",
            "verify": "gh issue view {id} --json labels"
        },
        "pr": {
            "close": "gh pr close {id}",
            "reopen": "gh pr reopen {id}",
            "verify": "gh pr view {id} --json state"
        }
    }

    def __init__(self, incident_data: Dict[str, Any]):
        self.incident = incident_data
        self.affected_files: List[str] = []
        self.affected_repos: List[str] = []
        self.affected_resources: List[AffectedResource] = []
        self.evidence: List[Evidence] = []
        self.timeline: List[Dict[str, str]] = []
        self._add_timeline_event("incident_detected", "Incident detected and analysis started")

    def generate_id(self) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"INC-{timestamp}-{os.urandom(4).hex()}"

    def _add_timeline_event(self, event_type: str, description: str) -> None:
        self.timeline.append({
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "description": description
        })

    def analyze_impact(self) -> Dict[str, Any]:
        self._add_timeline_event("impact_analysis_started", "Starting impact analysis")

        impact = {
            "severity_score": 0,
            "affected_workflows": [],
            "affected_branches": [],
            "affected_issues": [],
            "affected_prs": [],
            "data_exposure_risk": False,
            "system_availability_impact": False,
            "integrity_impact": False
        }

        severity = self.incident.get("severity", "medium")
        impact["severity_score"] = self.SEVERITY_WEIGHTS.get(severity, 2)

        if self.incident.get("canceled_runs", 0) > 0:
            impact["system_availability_impact"] = True

        if self.incident.get("deleted_branches", 0) > 0:
            impact["integrity_impact"] = True

        threats = self.incident.get("threats", [])
        for threat in threats:
            threat_severity = threat.get("severity", "medium")
            impact["severity_score"] += self.SEVERITY_WEIGHTS.get(threat_severity, 1)

            if threat_severity in ["critical", "high"]:
                if "key" in threat.get("description", "").lower():
                    impact["data_exposure_risk"] = True
                if "injection" in threat.get("description", "").lower():
                    impact["integrity_impact"] = True

        self._add_timeline_event("impact_analysis_completed", f"Impact analysis completed. Severity score: {impact['severity_score']}")

        return impact

    def identify_affected_resources(self) -> List[AffectedResource]:
        self._add_timeline_event("resource_identification_started", "Identifying affected resources")

        resources = []

        canceled_runs = self.incident.get("canceled_runs", 0)
        if canceled_runs > 0:
            resources.append(AffectedResource(
                resource_type="workflow",
                resource_id="multiple",
                resource_name=f"{canceled_runs} running workflows",
                impact_level="high",
                recovery_action="manual_review"
            ))

        deleted_branches = self.incident.get("deleted_branches", 0)
        if deleted_branches > 0:
            resources.append(AffectedResource(
                resource_type="branch",
                resource_id="multiple",
                resource_name=f"{deleted_branches} ai-task-* branches",
                impact_level="medium",
                recovery_action="restore_from_reflog"
            ))

        for threat in self.incident.get("threats", []):
            file_path = threat.get("file", "")
            if file_path:
                resources.append(AffectedResource(
                    resource_type="file",
                    resource_id=file_path,
                    resource_name=os.path.basename(file_path),
                    impact_level=threat.get("severity", "medium"),
                    recovery_action="revert_changes"
                ))

        self.affected_resources = resources
        self._add_timeline_event("resource_identification_completed", f"Identified {len(resources)} affected resources")

        return resources

    def generate_rollback_plan(self) -> List[RollbackStep]:
        self._add_timeline_event("rollback_planning_started", "Generating rollback plan")

        steps = []
        step_num = 1

        steps.append(RollbackStep(
            step_number=step_num,
            action="Verify incident containment",
            command="gh run list --repo {repo} --status in_progress --json databaseId",
            verification="No critical workflows running",
            risk_level="low"
        ))
        step_num += 1

        if self.incident.get("deleted_branches", 0) > 0:
            steps.append(RollbackStep(
                step_number=step_num,
                action="Check reflog for deleted branches",
                command="git reflog --all | grep 'ai-task-'",
                verification="Branch SHAs identified",
                risk_level="low"
            ))
            step_num += 1

            steps.append(RollbackStep(
                step_number=step_num,
                action="Restore deleted branches if needed",
                command="git branch {branch_name} {sha} && git push origin {branch_name}",
                verification="Branches restored",
                risk_level="medium"
            ))
            step_num += 1

        for threat in self.incident.get("threats", []):
            if threat.get("severity") in ["critical", "high"]:
                file_path = threat.get("file", "")
                if file_path:
                    steps.append(RollbackStep(
                        step_number=step_num,
                        action=f"Review/revert changes to {os.path.basename(file_path)}",
                        command=f"git log --oneline -5 {file_path}",
                        verification="Changes reviewed",
                        risk_level="high"
                    ))
                    step_num += 1

        steps.append(RollbackStep(
            step_number=step_num,
            action="Update affected issues status",
            command="gh issue edit {issue_number} --remove-label ai:blocked --add-label ai:ready",
            verification="Issues updated for manual review",
            risk_level="low"
        ))
        step_num += 1

        steps.append(RollbackStep(
            step_number=step_num,
            action="Document lessons learned",
            command="echo 'Update incident documentation'",
            verification="Documentation complete",
            risk_level="low"
        ))

        self._add_timeline_event("rollback_planning_completed", f"Generated {len(steps)} rollback steps")

        return steps

    def collect_evidence(self) -> List[Evidence]:
        self._add_timeline_event("evidence_collection_started", "Collecting incident evidence")

        evidence_list = []

        incident_json = json.dumps(self.incident, indent=2)
        evidence_list.append(Evidence(
            evidence_type="incident_data",
            source="workflow_input",
            timestamp=datetime.utcnow().isoformat(),
            content=incident_json,
            hash=self._compute_hash(incident_json)
        ))

        for threat in self.incident.get("threats", []):
            threat_json = json.dumps(threat, indent=2)
            evidence_list.append(Evidence(
                evidence_type="threat_detection",
                source=threat.get("file", "unknown"),
                timestamp=datetime.utcnow().isoformat(),
                content=threat_json,
                hash=self._compute_hash(threat_json)
            ))

        self.evidence = evidence_list
        self._add_timeline_event("evidence_collection_completed", f"Collected {len(evidence_list)} evidence items")

        return evidence_list

    def _compute_hash(self, content: str) -> str:
        import hashlib
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def generate_recommendations(self) -> List[str]:
        recommendations = []

        severity = self.incident.get("severity", "medium")
        if severity in ["critical", "high"]:
            recommendations.append("Immediate manual review required by security team")
            recommendations.append("Consider rotating any potentially exposed credentials")

        threats = self.incident.get("threats", [])
        for threat in threats:
            desc = threat.get("description", "").lower()
            if "key" in desc or "secret" in desc:
                recommendations.append("Review and rotate exposed secrets/API keys")
            if "injection" in desc:
                recommendations.append("Review input validation and sanitization")
            if "password" in desc:
                recommendations.append("Change affected passwords immediately")

        if self.incident.get("deleted_branches", 0) > 0:
            recommendations.append("Review git reflog before branch recovery")

        recommendations.append("Update security scanning rules to catch similar threats")
        recommendations.append("Document incident for post-mortem review")

        return list(set(recommendations))

    def create_report(self) -> IncidentReport:
        self._add_timeline_event("report_generation_started", "Generating incident report")

        impact = self.analyze_impact()
        resources = self.identify_affected_resources()
        rollback_steps = self.generate_rollback_plan()
        evidence_list = self.collect_evidence()
        recommendations = self.generate_recommendations()

        severity_score = impact.get("severity_score", 0)
        if severity_score >= 4:
            status = IncidentStatus.DETECTED.value
        elif severity_score >= 2:
            status = IncidentStatus.CONTAINED.value
        else:
            status = IncidentStatus.RESOLVING.value

        report = IncidentReport(
            incident_id=self.generate_id(),
            timestamp=datetime.utcnow().isoformat(),
            severity=self.incident.get("severity", "medium"),
            status=status,
            summary=self._generate_summary(impact),
            threats=self.incident.get("threats", []),
            affected_resources=[asdict(r) for r in resources],
            rollback_plan=[asdict(s) for s in rollback_steps],
            evidence=[asdict(e) for e in evidence_list],
            recommendations=recommendations,
            timeline=self.timeline
        )

        self._add_timeline_event("report_generation_completed", "Incident report generated")

        return report

    def _generate_summary(self, impact: Dict[str, Any]) -> str:
        severity = self.incident.get("severity", "medium").upper()
        reason = self.incident.get("reason", "Unknown")
        canceled = self.incident.get("canceled_runs", 0)
        deleted = self.incident.get("deleted_branches", 0)
        threat_count = len(self.incident.get("threats", []))

        summary_parts = [
            f"[{severity}] {reason}",
            f"{threat_count} threat(s) detected",
        ]

        if canceled > 0:
            summary_parts.append(f"{canceled} workflow(s) canceled")
        if deleted > 0:
            summary_parts.append(f"{deleted} branch(es) deleted")

        if impact.get("data_exposure_risk"):
            summary_parts.append("Potential data exposure risk")
        if impact.get("integrity_impact"):
            summary_parts.append("System integrity potentially compromised")

        return ". ".join(summary_parts) + "."

    def export_report(self, report: IncidentReport, format: str = "json") -> str:
        if format == "json":
            return json.dumps(asdict(report), indent=2)
        elif format == "markdown":
            return self._format_markdown(report)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def _format_markdown(self, report: IncidentReport) -> str:
        lines = [
            f"# Incident Report: {report.incident_id}",
            "",
            "## Overview",
            "",
            f"| Field | Value |",
            f"|-------|-------|",
            f"| **Incident ID** | {report.incident_id} |",
            f"| **Timestamp** | {report.timestamp} |",
            f"| **Severity** | {report.severity} |",
            f"| **Status** | {report.status} |",
            "",
            "## Summary",
            "",
            report.summary,
            "",
            "## Affected Resources",
            "",
        ]

        for resource in report.affected_resources:
            lines.append(f"- **{resource['resource_type']}**: {resource['resource_name']} (Impact: {resource['impact_level']})")

        lines.extend([
            "",
            "## Rollback Plan",
            "",
        ])

        for step in report.rollback_plan:
            lines.append(f"{step['step_number']}. **{step['action']}** (Risk: {step['risk_level']})")
            lines.append(f"   - Command: `{step['command']}`")
            lines.append(f"   - Verification: {step['verification']}")
            lines.append("")

        lines.extend([
            "## Recommendations",
            "",
        ])

        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"{i}. {rec}")

        lines.extend([
            "",
            "## Timeline",
            "",
        ])

        for event in report.timeline:
            lines.append(f"- `{event['timestamp']}`: {event['description']}")

        lines.extend([
            "",
            "---",
            f"*Generated by Emergency Response System at {datetime.utcnow().isoformat()}*",
        ])

        return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description='Emergency Response System')
    parser.add_argument('--incident-file', '-f', help='JSON file containing incident data')
    parser.add_argument('--incident-json', '-j', help='JSON string containing incident data')
    parser.add_argument('--output-format', '-o', default='json', choices=['json', 'markdown'],
                        help='Output format')
    parser.add_argument('--output-file', help='Output file path (default: stdout)')
    parser.add_argument('--severity', choices=['critical', 'high', 'medium', 'low'],
                        help='Override incident severity')
    parser.add_argument('--reason', help='Incident reason (for manual invocation)')

    args = parser.parse_args()

    incident_data = {}

    if args.incident_file:
        with open(args.incident_file, 'r') as f:
            incident_data = json.load(f)
    elif args.incident_json:
        incident_data = json.loads(args.incident_json)
    else:
        if args.reason:
            incident_data['reason'] = args.reason
        if args.severity:
            incident_data['severity'] = args.severity
        incident_data.setdefault('reason', 'Manual emergency response')
        incident_data.setdefault('severity', 'high')
        incident_data.setdefault('timestamp', datetime.utcnow().isoformat())

    if args.severity:
        incident_data['severity'] = args.severity

    response = EmergencyResponse(incident_data)
    report = response.create_report()
    output = response.export_report(report, args.output_format)

    if args.output_file:
        with open(args.output_file, 'w') as f:
            f.write(output)
        print(f"Report written to {args.output_file}", file=sys.stderr)
    else:
        print(output)

    return 0


if __name__ == '__main__':
    sys.exit(main())
