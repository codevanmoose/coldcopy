"""
GDPR service for compliance operations.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date, timedelta

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models.gdpr import (
    ConsentRecord, DataSubjectRequestModel, GDPRAuditLog, SuppressionListModel,
    ConsentRequest, ConsentResponse, DataSubjectRequest, DataSubjectRequestResponse,
    SuppressionRequest, ConsentType, ConsentStatus, RequestType, RequestStatus
)
from models.lead import Lead
from models.user import User


class GDPRService:
    """Service class for GDPR compliance operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def record_consent(
        self, 
        workspace_id: UUID, 
        consent_request: ConsentRequest
    ) -> ConsentResponse:
        """Record consent for data processing."""
        # Check if consent record already exists
        result = await self.db.execute(
            select(ConsentRecord).where(
                and_(
                    ConsentRecord.workspace_id == workspace_id,
                    ConsentRecord.email == consent_request.email,
                    ConsentRecord.consent_type == consent_request.consent_type
                )
            )
        )
        existing_consent = result.scalar_one_or_none()
        
        if existing_consent:
            # Update existing consent
            existing_consent.status = consent_request.status
            existing_consent.version = consent_request.version
            existing_consent.expiry_date = consent_request.expiry_date
            existing_consent.metadata = consent_request.metadata
            db_consent = existing_consent
        else:
            # Create new consent record
            db_consent = ConsentRecord(
                workspace_id=workspace_id,
                email=consent_request.email,
                consent_type=consent_request.consent_type,
                status=consent_request.status,
                version=consent_request.version,
                expiry_date=consent_request.expiry_date,
                metadata=consent_request.metadata
            )
            self.db.add(db_consent)
        
        await self.db.commit()
        await self.db.refresh(db_consent)
        
        # Log the consent action
        await self._log_gdpr_action(
            workspace_id=workspace_id,
            action=f"consent_{consent_request.status}",
            action_category="consent",
            resource_type="consent_record",
            resource_id=str(db_consent.id),
            details={
                "email": consent_request.email,
                "consent_type": consent_request.consent_type,
                "status": consent_request.status
            }
        )
        
        return ConsentResponse(
            id=db_consent.id,
            email=db_consent.email,
            consent_type=db_consent.consent_type,
            status=db_consent.status,
            version=db_consent.version,
            expiry_date=db_consent.expiry_date,
            created_at=db_consent.created_at.isoformat()
        )
    
    async def check_consent(
        self, 
        workspace_id: UUID, 
        email: str, 
        consent_type: str
    ) -> bool:
        """Check if valid consent exists for email and consent type."""
        result = await self.db.execute(
            select(ConsentRecord).where(
                and_(
                    ConsentRecord.workspace_id == workspace_id,
                    ConsentRecord.email == email,
                    ConsentRecord.consent_type == ConsentType(consent_type),
                    ConsentRecord.status == ConsentStatus.GIVEN,
                    or_(
                        ConsentRecord.expiry_date.is_(None),
                        ConsentRecord.expiry_date > date.today()
                    )
                )
            )
        )
        consent = result.scalar_one_or_none()
        return consent is not None
    
    async def create_data_subject_request(
        self, 
        workspace_id: UUID, 
        request: DataSubjectRequest
    ) -> DataSubjectRequestResponse:
        """Create a data subject request."""
        deadline = date.today() + timedelta(days=30)  # GDPR requires response within 30 days
        
        db_request = DataSubjectRequestModel(
            workspace_id=workspace_id,
            email=request.email,
            request_type=request.request_type,
            description=request.description,
            deadline=deadline
        )
        
        self.db.add(db_request)
        await self.db.commit()
        await self.db.refresh(db_request)
        
        # Log the request creation
        await self._log_gdpr_action(
            workspace_id=workspace_id,
            action="create_data_subject_request",
            action_category="data_subject_rights",
            resource_type="data_subject_request",
            resource_id=str(db_request.id),
            details={
                "email": request.email,
                "request_type": request.request_type,
                "deadline": deadline.isoformat()
            }
        )
        
        return DataSubjectRequestResponse(
            id=db_request.id,
            email=db_request.email,
            request_type=db_request.request_type,
            status=db_request.status,
            description=db_request.description,
            deadline=db_request.deadline,
            completed_at=db_request.completed_at,
            created_at=db_request.created_at.isoformat()
        )
    
    async def get_data_subject_requests(
        self, 
        workspace_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[DataSubjectRequestResponse]:
        """Get data subject requests for workspace."""
        result = await self.db.execute(
            select(DataSubjectRequestModel)
            .where(DataSubjectRequestModel.workspace_id == workspace_id)
            .offset(skip)
            .limit(limit)
        )
        
        requests = result.scalars().all()
        return [
            DataSubjectRequestResponse(
                id=req.id,
                email=req.email,
                request_type=req.request_type,
                status=req.status,
                description=req.description,
                deadline=req.deadline,
                completed_at=req.completed_at,
                created_at=req.created_at.isoformat()
            )
            for req in requests
        ]
    
    async def export_personal_data(
        self, 
        workspace_id: UUID, 
        email: str, 
        export_format: str = "json"
    ) -> Dict[str, Any]:
        """Export personal data for a given email address."""
        # Collect data from leads table
        lead_result = await self.db.execute(
            select(Lead).where(
                and_(
                    Lead.workspace_id == workspace_id,
                    Lead.email == email
                )
            )
        )
        leads = lead_result.scalars().all()
        
        # Collect consent records
        consent_result = await self.db.execute(
            select(ConsentRecord).where(
                and_(
                    ConsentRecord.workspace_id == workspace_id,
                    ConsentRecord.email == email
                )
            )
        )
        consents = consent_result.scalars().all()
        
        # Prepare export data
        export_data = {
            "email": email,
            "export_date": datetime.utcnow().isoformat(),
            "format": export_format,
            "data": {
                "leads": [
                    {
                        "id": str(lead.id),
                        "first_name": lead.first_name,
                        "last_name": lead.last_name,
                        "company": lead.company,
                        "title": lead.title,
                        "phone": lead.phone,
                        "status": lead.status,
                        "enrichment_data": lead.enrichment_data,
                        "notes": lead.notes,
                        "created_at": lead.created_at.isoformat(),
                        "updated_at": lead.updated_at.isoformat()
                    }
                    for lead in leads
                ],
                "consents": [
                    {
                        "id": str(consent.id),
                        "consent_type": consent.consent_type,
                        "status": consent.status,
                        "version": consent.version,
                        "expiry_date": consent.expiry_date.isoformat() if consent.expiry_date else None,
                        "created_at": consent.created_at.isoformat(),
                        "updated_at": consent.updated_at.isoformat()
                    }
                    for consent in consents
                ]
            }
        }
        
        # Log the export action
        await self._log_gdpr_action(
            workspace_id=workspace_id,
            action="export_personal_data",
            action_category="data_subject_rights",
            resource_type="personal_data",
            resource_id=email,
            details={"export_format": export_format}
        )
        
        return export_data
    
    async def delete_personal_data(
        self, 
        workspace_id: UUID, 
        email: str, 
        deletion_strategy: str = "anonymize"
    ) -> None:
        """Delete personal data for a given email address."""
        if deletion_strategy == "hard_delete":
            # Hard delete - remove all records
            await self.db.execute(
                select(Lead).where(
                    and_(
                        Lead.workspace_id == workspace_id,
                        Lead.email == email
                    )
                ).delete()
            )
        elif deletion_strategy == "anonymize":
            # Anonymize - replace with anonymous values
            lead_result = await self.db.execute(
                select(Lead).where(
                    and_(
                        Lead.workspace_id == workspace_id,
                        Lead.email == email
                    )
                )
            )
            leads = lead_result.scalars().all()
            
            for lead in leads:
                lead.email = f"anonymous_{lead.id}@deleted.local"
                lead.first_name = "Anonymous"
                lead.last_name = "User"
                lead.phone = None
                lead.enrichment_data = {}
                lead.notes = "Data anonymized per GDPR request"
        
        await self.db.commit()
        
        # Log the deletion action
        await self._log_gdpr_action(
            workspace_id=workspace_id,
            action="delete_personal_data",
            action_category="data_subject_rights",
            resource_type="personal_data",
            resource_id=email,
            details={"deletion_strategy": deletion_strategy}
        )
    
    async def add_to_suppression_list(
        self, 
        workspace_id: UUID, 
        suppression_request: SuppressionRequest
    ) -> None:
        """Add email to suppression list."""
        # Check if already suppressed
        result = await self.db.execute(
            select(SuppressionListModel).where(
                and_(
                    SuppressionListModel.workspace_id == workspace_id,
                    SuppressionListModel.email == suppression_request.email
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            db_suppression = SuppressionListModel(
                workspace_id=workspace_id,
                email=suppression_request.email,
                suppression_type=suppression_request.suppression_type,
                reason=suppression_request.reason
            )
            self.db.add(db_suppression)
            await self.db.commit()
            
            # Log the suppression action
            await self._log_gdpr_action(
                workspace_id=workspace_id,
                action="add_to_suppression_list",
                action_category="suppression",
                resource_type="suppression_list",
                resource_id=suppression_request.email,
                details={
                    "suppression_type": suppression_request.suppression_type,
                    "reason": suppression_request.reason
                }
            )
    
    async def get_suppression_list(
        self, 
        workspace_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get suppression list for workspace."""
        result = await self.db.execute(
            select(SuppressionListModel)
            .where(SuppressionListModel.workspace_id == workspace_id)
            .offset(skip)
            .limit(limit)
        )
        
        suppressions = result.scalars().all()
        return [
            {
                "id": str(suppression.id),
                "email": suppression.email,
                "suppression_type": suppression.suppression_type,
                "reason": suppression.reason,
                "created_at": suppression.created_at.isoformat()
            }
            for suppression in suppressions
        ]
    
    async def get_audit_logs(
        self, 
        workspace_id: UUID, 
        skip: int = 0, 
        limit: int = 100,
        action_category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get GDPR audit logs for workspace."""
        query = select(GDPRAuditLog).where(GDPRAuditLog.workspace_id == workspace_id)
        
        if action_category:
            query = query.where(GDPRAuditLog.action_category == action_category)
        
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        
        logs = result.scalars().all()
        return [
            {
                "id": str(log.id),
                "action": log.action,
                "action_category": log.action_category,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "timestamp": log.timestamp.isoformat(),
                "created_at": log.created_at.isoformat()
            }
            for log in logs
        ]
    
    async def _log_gdpr_action(
        self,
        workspace_id: UUID,
        action: str,
        action_category: str,
        resource_type: str,
        resource_id: str,
        details: Optional[Dict[str, Any]] = None,
        user_id: Optional[UUID] = None
    ) -> None:
        """Log a GDPR-related action."""
        log_entry = GDPRAuditLog(
            workspace_id=workspace_id,
            user_id=user_id,
            action=action,
            action_category=action_category,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            timestamp=datetime.utcnow()
        )
        
        self.db.add(log_entry)
        await self.db.commit()