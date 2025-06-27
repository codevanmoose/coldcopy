"""
GDPR compliance and data management Celery tasks.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from workers.celery_app import celery_app
from core.database import get_async_session

logger = logging.getLogger(__name__)


def run_async(coro):
    """Helper to run async functions in Celery tasks."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(coro)


@celery_app.task
def check_data_retention() -> Dict[str, Any]:
    """Check and enforce data retention policies across all workspaces."""
    try:
        from services.gdpr_service import GDPRService
        
        async def _check_retention():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                # Get all active retention policies
                retention_policies = await gdpr_service.get_all_retention_policies()
                
                processed_policies = 0
                total_deleted = 0
                
                for policy in retention_policies:
                    try:
                        # Execute retention policy
                        deleted_count = await gdpr_service.execute_retention_policy(policy)
                        
                        total_deleted += deleted_count
                        processed_policies += 1
                        
                        # Log retention execution
                        await gdpr_service.log_retention_execution(
                            policy_id=policy.id,
                            deleted_count=deleted_count,
                            execution_time=datetime.utcnow()
                        )
                        
                    except Exception as e:
                        logger.error(f"Failed to execute retention policy {policy.id}: {str(e)}")
                
                return {
                    "processed_policies": processed_policies,
                    "total_deleted_records": total_deleted
                }
        
        result = run_async(_check_retention())
        
        logger.info(f"Processed {result['processed_policies']} retention policies, "
                   f"deleted {result['total_deleted_records']} records")
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            **result
        }
        
    except Exception as exc:
        logger.error(f"Error checking data retention: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def process_data_subject_request(request_id: str) -> Dict[str, Any]:
    """Process a data subject request (access, deletion, etc.)."""
    try:
        from services.gdpr_service import GDPRService
        
        async def _process_request():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                request_uuid = UUID(request_id)
                
                # Get request details
                request = await gdpr_service.get_data_subject_request(request_uuid)
                if not request:
                    raise ValueError(f"Request {request_id} not found")
                
                # Process based on request type
                if request.request_type == "access":
                    result = await gdpr_service.export_personal_data(
                        workspace_id=request.workspace_id,
                        email=request.email,
                        export_format="json"
                    )
                elif request.request_type == "deletion":
                    result = await gdpr_service.delete_personal_data(
                        workspace_id=request.workspace_id,
                        email=request.email,
                        deletion_strategy="complete"
                    )
                elif request.request_type == "rectification":
                    result = await gdpr_service.rectify_personal_data(
                        workspace_id=request.workspace_id,
                        email=request.email,
                        corrections=request.request_data.get("corrections", {})
                    )
                elif request.request_type == "restriction":
                    result = await gdpr_service.restrict_data_processing(
                        workspace_id=request.workspace_id,
                        email=request.email
                    )
                else:
                    raise ValueError(f"Unknown request type: {request.request_type}")
                
                # Update request status
                await gdpr_service.update_request_status(
                    request_id=request_uuid,
                    status="completed",
                    completion_data=result
                )
                
                return result
        
        result = run_async(_process_request())
        
        logger.info(f"Processed data subject request {request_id}")
        return {
            "status": "completed",
            "request_id": request_id,
            "result": result,
            "processed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as exc:
        logger.error(f"Error processing data subject request: {str(exc)}")
        return {"status": "failed", "error": str(exc), "request_id": request_id}


@celery_app.task
def audit_consent_status() -> Dict[str, Any]:
    """Audit consent status across all workspaces and identify issues."""
    try:
        from services.gdpr_service import GDPRService
        
        async def _audit_consent():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                # Get all workspaces
                workspaces = await gdpr_service.get_all_workspaces()
                
                audit_results = {
                    "total_workspaces": len(workspaces),
                    "issues_found": [],
                    "consent_summary": {}
                }
                
                for workspace in workspaces:
                    try:
                        # Audit consent for this workspace
                        workspace_audit = await gdpr_service.audit_workspace_consent(workspace.id)
                        
                        audit_results["consent_summary"][str(workspace.id)] = workspace_audit
                        
                        # Check for issues
                        if workspace_audit.get("expired_consents", 0) > 0:
                            audit_results["issues_found"].append({
                                "workspace_id": str(workspace.id),
                                "issue": "expired_consents",
                                "count": workspace_audit["expired_consents"]
                            })
                        
                        if workspace_audit.get("missing_consents", 0) > 0:
                            audit_results["issues_found"].append({
                                "workspace_id": str(workspace.id),
                                "issue": "missing_consents",
                                "count": workspace_audit["missing_consents"]
                            })
                        
                    except Exception as e:
                        logger.error(f"Failed to audit consent for workspace {workspace.id}: {str(e)}")
                        audit_results["issues_found"].append({
                            "workspace_id": str(workspace.id),
                            "issue": "audit_failed",
                            "error": str(e)
                        })
                
                return audit_results
        
        audit_results = run_async(_audit_consent())
        
        logger.info(f"Completed consent audit for {audit_results['total_workspaces']} workspaces, "
                   f"found {len(audit_results['issues_found'])} issues")
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            **audit_results
        }
        
    except Exception as exc:
        logger.error(f"Error auditing consent status: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def cleanup_expired_data() -> Dict[str, Any]:
    """Clean up expired data based on GDPR requirements."""
    try:
        from services.gdpr_service import GDPRService
        
        async def _cleanup_expired():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                cleanup_results = {}
                
                # Clean up expired consent records
                expired_consents = await gdpr_service.cleanup_expired_consents()
                cleanup_results["expired_consents"] = expired_consents
                
                # Clean up old audit logs (keep for legal requirements)
                old_audit_logs = await gdpr_service.cleanup_old_audit_logs(
                    retention_days=2555  # 7 years
                )
                cleanup_results["old_audit_logs"] = old_audit_logs
                
                # Clean up completed data subject requests (after retention period)
                old_requests = await gdpr_service.cleanup_old_requests(
                    retention_days=90  # 3 months after completion
                )
                cleanup_results["old_requests"] = old_requests
                
                # Clean up temporary export files
                temp_files = await gdpr_service.cleanup_temporary_exports()
                cleanup_results["temp_files"] = temp_files
                
                return cleanup_results
        
        cleanup_results = run_async(_cleanup_expired())
        
        total_cleaned = sum(cleanup_results.values())
        logger.info(f"GDPR cleanup completed, removed {total_cleaned} records")
        
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            "cleanup_results": cleanup_results,
            "total_cleaned": total_cleaned
        }
        
    except Exception as exc:
        logger.error(f"Error cleaning up expired data: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def generate_compliance_report(workspace_id: str, report_type: str = "full") -> Dict[str, Any]:
    """Generate GDPR compliance report for a workspace."""
    try:
        from services.gdpr_service import GDPRService
        
        async def _generate_report():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                workspace_uuid = UUID(workspace_id)
                
                if report_type == "full":
                    report_data = await gdpr_service.generate_full_compliance_report(workspace_uuid)
                elif report_type == "consent":
                    report_data = await gdpr_service.generate_consent_report(workspace_uuid)
                elif report_type == "data_mapping":
                    report_data = await gdpr_service.generate_data_mapping_report(workspace_uuid)
                elif report_type == "requests":
                    report_data = await gdpr_service.generate_requests_report(workspace_uuid)
                else:
                    raise ValueError(f"Unknown report type: {report_type}")
                
                # Store report for later retrieval
                report_id = await gdpr_service.store_compliance_report(
                    workspace_id=workspace_uuid,
                    report_type=report_type,
                    report_data=report_data
                )
                
                return {"report_id": str(report_id), "report_data": report_data}
        
        result = run_async(_generate_report())
        
        logger.info(f"Generated {report_type} compliance report for workspace {workspace_id}")
        return {
            "status": "completed",
            "workspace_id": workspace_id,
            "report_type": report_type,
            "generated_at": datetime.utcnow().isoformat(),
            **result
        }
        
    except Exception as exc:
        logger.error(f"Error generating compliance report: {str(exc)}")
        return {"status": "failed", "error": str(exc), "workspace_id": workspace_id}


@celery_app.task
def sync_suppression_lists() -> Dict[str, Any]:
    """Sync suppression lists across email providers and internal systems."""
    try:
        from services.gdpr_service import GDPRService
        from utils.email_client import email_client
        
        async def _sync_suppressions():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                await email_client.initialize()
                
                # Get suppression list from SES
                ses_suppressions = await email_client.deliverability_monitor.get_suppression_list()
                
                # Get internal suppression list
                internal_suppressions = await gdpr_service.get_internal_suppression_list()
                
                sync_results = {
                    "ses_count": len(ses_suppressions),
                    "internal_count": len(internal_suppressions),
                    "added_to_internal": 0,
                    "added_to_ses": 0
                }
                
                # Add SES suppressions to internal list
                for email in ses_suppressions:
                    if email not in internal_suppressions:
                        await gdpr_service.add_to_suppression_list(
                            email=email,
                            reason="ses_suppression",
                            source="amazon_ses"
                        )
                        sync_results["added_to_internal"] += 1
                
                await email_client.cleanup()
                
                return sync_results
        
        sync_results = run_async(_sync_suppressions())
        
        logger.info(f"Synced suppression lists: {sync_results}")
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            "sync_results": sync_results
        }
        
    except Exception as exc:
        logger.error(f"Error syncing suppression lists: {str(exc)}")
        return {"status": "failed", "error": str(exc)}


@celery_app.task
def validate_data_processing_purposes() -> Dict[str, Any]:
    """Validate that data processing aligns with stated purposes."""
    try:
        from services.gdpr_service import GDPRService
        
        async def _validate_purposes():
            async with get_async_session() as db:
                gdpr_service = GDPRService(db)
                
                # Get all workspaces and their processing purposes
                validation_results = await gdpr_service.validate_processing_purposes()
                
                violations_found = []
                compliant_workspaces = 0
                
                for workspace_id, validation in validation_results.items():
                    if validation.get("violations"):
                        violations_found.extend([
                            {
                                "workspace_id": workspace_id,
                                "violation": violation
                            }
                            for violation in validation["violations"]
                        ])
                    else:
                        compliant_workspaces += 1
                
                return {
                    "total_workspaces": len(validation_results),
                    "compliant_workspaces": compliant_workspaces,
                    "violations_found": len(violations_found),
                    "violations": violations_found
                }
        
        validation_results = run_async(_validate_purposes())
        
        logger.info(f"Validated data processing purposes: "
                   f"{validation_results['compliant_workspaces']}/{validation_results['total_workspaces']} compliant")
        
        return {
            "status": "completed",
            "timestamp": datetime.utcnow().isoformat(),
            **validation_results
        }
        
    except Exception as exc:
        logger.error(f"Error validating data processing purposes: {str(exc)}")
        return {"status": "failed", "error": str(exc)}