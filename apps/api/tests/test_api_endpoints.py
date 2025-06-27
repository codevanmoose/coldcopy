"""
Comprehensive API endpoint tests for ColdCopy.
"""
import pytest
import uuid
from datetime import datetime
from unittest.mock import patch, AsyncMock

from httpx import AsyncClient


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    async def test_health_check(self, client: AsyncClient):
        """Test basic health check."""
        response = await client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    async def test_health_check_with_services(self, client: AsyncClient, mock_redis):
        """Test health check with service status."""
        response = await client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "services" in data
        # Should check Redis, database, etc.


class TestAuthenticationEndpoints:
    """Test authentication endpoints."""
    
    async def test_login_success(self, client: AsyncClient, test_user, mock_auth):
        """Test successful login."""
        login_data = {
            "email": "test@example.com",
            "password": "testpassword"
        }
        
        with patch('core.security.verify_password', return_value=True):
            with patch('core.security.create_access_token', return_value="mock.jwt.token"):
                response = await client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        login_data = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        
        response = await client.post("/api/auth/login", json=login_data)
        assert response.status_code == 401
    
    async def test_login_missing_fields(self, client: AsyncClient):
        """Test login with missing fields."""
        login_data = {"email": "test@example.com"}
        
        response = await client.post("/api/auth/login", json=login_data)
        assert response.status_code == 422
    
    async def test_refresh_token(self, client: AsyncClient, auth_headers):
        """Test token refresh."""
        with patch('core.security.verify_refresh_token', return_value=True):
            with patch('core.security.create_access_token', return_value="new.jwt.token"):
                response = await client.post(
                    "/api/auth/refresh",
                    headers=auth_headers,
                    json={"refresh_token": "valid.refresh.token"}
                )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


class TestCampaignEndpoints:
    """Test campaign management endpoints."""
    
    async def test_get_campaigns(self, client: AsyncClient, auth_headers, test_campaign, mock_auth):
        """Test getting list of campaigns."""
        response = await client.get("/api/campaigns", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
    
    async def test_create_campaign(self, client: AsyncClient, auth_headers, sample_campaign_data, mock_auth):
        """Test creating a new campaign."""
        response = await client.post(
            "/api/campaigns",
            headers=auth_headers,
            json=sample_campaign_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_campaign_data["name"]
        assert "id" in data
        assert "created_at" in data
    
    async def test_get_campaign_by_id(self, client: AsyncClient, auth_headers, test_campaign, mock_auth):
        """Test getting specific campaign."""
        response = await client.get(
            f"/api/campaigns/{test_campaign.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_campaign.id
        assert data["name"] == test_campaign.name
    
    async def test_update_campaign(self, client: AsyncClient, auth_headers, test_campaign, mock_auth):
        """Test updating a campaign."""
        update_data = {
            "name": "Updated Campaign Name",
            "description": "Updated description"
        }
        
        response = await client.put(
            f"/api/campaigns/{test_campaign.id}",
            headers=auth_headers,
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
    
    async def test_delete_campaign(self, client: AsyncClient, auth_headers, test_campaign, mock_auth):
        """Test deleting a campaign."""
        response = await client.delete(
            f"/api/campaigns/{test_campaign.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
    
    async def test_campaign_not_found(self, client: AsyncClient, auth_headers, mock_auth):
        """Test getting non-existent campaign."""
        fake_id = str(uuid.uuid4())
        response = await client.get(
            f"/api/campaigns/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_campaign_analytics(self, client: AsyncClient, auth_headers, test_campaign, mock_auth):
        """Test getting campaign analytics."""
        response = await client.get(
            f"/api/campaigns/{test_campaign.id}/analytics",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "emails_sent" in data
        assert "open_rate" in data
        assert "click_rate" in data


class TestLeadEndpoints:
    """Test lead management endpoints."""
    
    async def test_get_leads(self, client: AsyncClient, auth_headers, test_lead, mock_auth):
        """Test getting list of leads."""
        response = await client.get("/api/leads", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    async def test_create_lead(self, client: AsyncClient, auth_headers, sample_lead_data, mock_auth):
        """Test creating a new lead."""
        response = await client.post(
            "/api/leads",
            headers=auth_headers,
            json=sample_lead_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == sample_lead_data["email"]
        assert data["first_name"] == sample_lead_data["first_name"]
    
    async def test_create_bulk_leads(self, client: AsyncClient, auth_headers, performance_test_data, mock_auth):
        """Test creating multiple leads at once."""
        bulk_data = {
            "leads": performance_test_data["bulk_leads"][:10]  # Test with 10 leads
        }
        
        response = await client.post(
            "/api/leads/bulk",
            headers=auth_headers,
            json=bulk_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert "created_count" in data
        assert "failed_count" in data
        assert data["created_count"] == 10
    
    async def test_get_lead_by_id(self, client: AsyncClient, auth_headers, test_lead, mock_auth):
        """Test getting specific lead."""
        response = await client.get(
            f"/api/leads/{test_lead.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_lead.id
        assert data["email"] == test_lead.email
    
    async def test_update_lead(self, client: AsyncClient, auth_headers, test_lead, mock_auth):
        """Test updating a lead."""
        update_data = {
            "first_name": "Updated Name",
            "title": "Updated Title"
        }
        
        response = await client.put(
            f"/api/leads/{test_lead.id}",
            headers=auth_headers,
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == update_data["first_name"]
    
    async def test_lead_enrichment(self, client: AsyncClient, auth_headers, test_lead, mock_auth):
        """Test lead enrichment."""
        with patch('utils.enrichment.enrich_lead') as mock_enrich:
            mock_enrich.return_value = {
                "title": "VP of Sales",
                "company_size": "51-200",
                "industry": "Technology"
            }
            
            response = await client.post(
                f"/api/leads/{test_lead.id}/enrich",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "enrichment_data" in data
    
    async def test_lead_search(self, client: AsyncClient, auth_headers, test_lead, mock_auth):
        """Test searching leads."""
        response = await client.get(
            "/api/leads/search",
            headers=auth_headers,
            params={"q": "john", "field": "first_name"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data


class TestEmailEndpoints:
    """Test email sending endpoints."""
    
    async def test_send_email(self, client: AsyncClient, auth_headers, sample_email_data, mock_auth, mock_celery):
        """Test sending a single email."""
        response = await client.post(
            "/api/email/send",
            headers=auth_headers,
            json=sample_email_data
        )
        
        assert response.status_code == 202
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "queued"
    
    async def test_send_bulk_email(self, client: AsyncClient, auth_headers, mock_auth, mock_celery):
        """Test sending bulk emails."""
        bulk_data = {
            "campaign_id": str(uuid.uuid4()),
            "subject": "Bulk Test Email",
            "html_content": "<h1>Bulk Email</h1>",
            "recipient_count": 100
        }
        
        response = await client.post(
            "/api/email/send-bulk",
            headers=auth_headers,
            json=bulk_data
        )
        
        assert response.status_code == 202
        data = response.json()
        assert "batch_id" in data
        assert data["status"] == "queued"
    
    async def test_email_templates(self, client: AsyncClient, auth_headers, mock_auth):
        """Test email template management."""
        template_data = {
            "name": "Test Template",
            "subject": "Test Subject {{first_name}}",
            "html_content": "<h1>Hello {{first_name}}</h1>",
            "variables": ["first_name", "company"]
        }
        
        # Create template
        response = await client.post(
            "/api/email/templates",
            headers=auth_headers,
            json=template_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == template_data["name"]
        template_id = data["id"]
        
        # Get template
        response = await client.get(
            f"/api/email/templates/{template_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
    
    async def test_email_preview(self, client: AsyncClient, auth_headers, mock_auth):
        """Test email preview functionality."""
        preview_data = {
            "subject": "Hello {{first_name}}",
            "html_content": "<h1>Hello {{first_name}} from {{company}}</h1>",
            "variables": {
                "first_name": "John",
                "company": "Example Corp"
            }
        }
        
        response = await client.post(
            "/api/email/preview",
            headers=auth_headers,
            json=preview_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "rendered_subject" in data
        assert "rendered_html" in data
        assert "John" in data["rendered_subject"]


class TestWebhookEndpoints:
    """Test webhook endpoints."""
    
    async def test_ses_webhook(self, client: AsyncClient, mock_celery):
        """Test SES webhook processing."""
        ses_payload = {
            "Type": "Notification",
            "Message": '{"eventType":"delivery","mail":{"messageId":"msg_123","timestamp":"2024-01-15T10:30:00.000Z","destination":["test@example.com"]},"delivery":{"timestamp":"2024-01-15T10:30:05.000Z","recipients":["test@example.com"]}}'
        }
        
        response = await client.post("/api/webhooks/ses", json=ses_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Event processed successfully"
    
    async def test_sendgrid_webhook(self, client: AsyncClient, mock_celery):
        """Test SendGrid webhook processing."""
        sendgrid_payload = [
            {
                "event": "delivered",
                "email": "test@example.com",
                "timestamp": 1642255800,
                "sg_event_id": "event_123",
                "sg_message_id": "msg_123"
            }
        ]
        
        response = await client.post("/api/webhooks/sendgrid", json=sendgrid_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "events queued" in data["message"]
    
    async def test_webhook_health(self, client: AsyncClient):
        """Test webhook health endpoint."""
        response = await client.get("/api/webhooks/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "supported_providers" in data


class TestVersioningEndpoints:
    """Test API versioning endpoints."""
    
    async def test_get_api_versions(self, client: AsyncClient):
        """Test getting all API versions."""
        response = await client.get("/api/versions/")
        
        assert response.status_code == 200
        data = response.json()
        assert "current_version" in data
        assert "latest_version" in data
        assert "versions" in data
        assert len(data["versions"]) >= 2  # v1 and v2
    
    async def test_get_version_details(self, client: AsyncClient):
        """Test getting specific version details."""
        response = await client.get("/api/versions/v2")
        
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == "v2"
        assert "release_date" in data
        assert "status" in data
    
    async def test_get_version_capabilities(self, client: AsyncClient):
        """Test getting version capabilities."""
        response = await client.get("/api/versions/v2/capabilities")
        
        assert response.status_code == 200
        data = response.json()
        assert "endpoints" in data
        assert "features" in data
        assert "rate_limits" in data
    
    async def test_migration_guide(self, client: AsyncClient):
        """Test getting migration guide."""
        response = await client.get(
            "/api/versions/migration/guide",
            params={"from_version": "v1", "to_version": "v2"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "migration_guide" in data
        assert "breaking_changes" in data["migration_guide"]
    
    async def test_version_headers(self, client: AsyncClient):
        """Test that version headers are returned."""
        headers = {"API-Version": "v2"}
        response = await client.get("/api/versions/current/info", headers=headers)
        
        assert response.status_code == 200
        assert "API-Version" in response.headers
        assert response.headers["API-Version"] == "v2"


class TestRateLimitingEndpoints:
    """Test rate limiting management endpoints."""
    
    async def test_rate_limit_analytics(self, client: AsyncClient, auth_headers, mock_auth):
        """Test getting rate limit analytics."""
        response = await client.get("/api/rate-limits/analytics", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "total_identifiers" in data
        assert "top_consumers" in data
        assert "recommendations" in data
    
    async def test_rate_limit_status(self, client: AsyncClient, auth_headers, mock_auth):
        """Test getting rate limit status."""
        response = await client.get(
            "/api/rate-limits/status/user:test-123",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "identifier" in data
        assert "status" in data
    
    async def test_create_rate_limit_override(self, client: AsyncClient, auth_headers, mock_auth):
        """Test creating rate limit override."""
        override_data = {
            "identifier_type": "user",
            "identifier_value": "test-user-123",
            "config": {
                "limit": 200,
                "window_seconds": 60,
                "description": "Test override"
            },
            "reason": "Testing purposes"
        }
        
        response = await client.post(
            "/api/rate-limits/override",
            headers=auth_headers,
            json=override_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "override_key" in data


class TestSystemEndpoints:
    """Test system monitoring endpoints."""
    
    async def test_system_health(self, client: AsyncClient, auth_headers, mock_auth):
        """Test system health check."""
        response = await client.get("/api/system/health", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "services" in data
    
    async def test_system_stats(self, client: AsyncClient, auth_headers, mock_auth):
        """Test getting system statistics."""
        response = await client.get("/api/system/stats", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "redis" in data
        assert "celery" in data
        assert "system" in data
    
    async def test_redis_info(self, client: AsyncClient, auth_headers, mock_auth):
        """Test getting Redis information."""
        response = await client.get("/api/system/redis/info", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "server_info" in data
        assert "memory_usage" in data
    
    async def test_celery_workers(self, client: AsyncClient, auth_headers, mock_auth):
        """Test getting Celery worker information."""
        response = await client.get("/api/system/celery/workers", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "active_workers" in data
        assert "registered_tasks" in data


class TestGDPREndpoints:
    """Test GDPR compliance endpoints."""
    
    async def test_record_consent(self, client: AsyncClient, auth_headers, mock_auth):
        """Test recording GDPR consent."""
        consent_data = {
            "email": "user@example.com",
            "consent_type": "marketing",
            "status": "granted",
            "version": "1.0"
        }
        
        response = await client.post(
            "/api/gdpr/consent",
            headers=auth_headers,
            json=consent_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "granted"
    
    async def test_data_export_request(self, client: AsyncClient, auth_headers, mock_auth):
        """Test creating data export request."""
        export_data = {
            "email": "user@example.com",
            "request_type": "export",
            "format": "json"
        }
        
        response = await client.post(
            "/api/gdpr/requests",
            headers=auth_headers,
            json=export_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["request_type"] == "export"
        assert "request_id" in data
    
    async def test_check_consent_status(self, client: AsyncClient, auth_headers, mock_auth):
        """Test checking consent status."""
        response = await client.get(
            "/api/gdpr/consent/check",
            headers=auth_headers,
            params={"email": "user@example.com", "consent_type": "marketing"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "consent_status" in data


class TestWorkspaceEndpoints:
    """Test workspace management endpoints."""
    
    async def test_get_workspaces(self, client: AsyncClient, auth_headers, mock_auth):
        """Test getting workspace list."""
        response = await client.get("/api/workspaces", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    
    async def test_get_workspace_settings(self, client: AsyncClient, auth_headers, test_workspace, mock_auth):
        """Test getting workspace settings."""
        response = await client.get(
            f"/api/workspaces/{test_workspace.id}/settings",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "settings" in data
    
    async def test_update_workspace_settings(self, client: AsyncClient, auth_headers, test_workspace, mock_auth):
        """Test updating workspace settings."""
        settings_data = {
            "email_sending_enabled": True,
            "daily_email_limit": 1000,
            "rate_limit_multiplier": 1.5
        }
        
        response = await client.put(
            f"/api/workspaces/{test_workspace.id}/settings",
            headers=auth_headers,
            json={"settings": settings_data}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["daily_email_limit"] == 1000


class TestErrorHandling:
    """Test error handling across endpoints."""
    
    async def test_unauthorized_access(self, client: AsyncClient):
        """Test accessing protected endpoint without auth."""
        response = await client.get("/api/campaigns")
        assert response.status_code == 401
    
    async def test_invalid_json(self, client: AsyncClient, auth_headers):
        """Test sending invalid JSON."""
        response = await client.post(
            "/api/campaigns",
            headers=auth_headers,
            content="invalid json"
        )
        assert response.status_code == 422
    
    async def test_validation_errors(self, client: AsyncClient, auth_headers, mock_auth):
        """Test validation error responses."""
        invalid_data = {
            "email": "not-an-email",  # Invalid email format
            "first_name": "",  # Empty required field
        }
        
        response = await client.post(
            "/api/leads",
            headers=auth_headers,
            json=invalid_data
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
    
    async def test_rate_limiting(self, client: AsyncClient, auth_headers, mock_redis):
        """Test rate limiting behavior."""
        # Mock rate limit exceeded
        mock_redis.check_rate_limit.return_value = {
            "allowed": False,
            "current_usage": 101,
            "limit": 100,
            "reset_time": datetime.utcnow().isoformat(),
            "retry_after": 60
        }
        
        response = await client.get("/api/campaigns", headers=auth_headers)
        assert response.status_code == 429
        assert "Retry-After" in response.headers


class TestPerformance:
    """Test API performance characteristics."""
    
    async def test_concurrent_requests(self, client: AsyncClient, auth_headers, mock_auth):
        """Test handling concurrent requests."""
        import asyncio
        
        async def make_request():
            return await client.get("/api/campaigns", headers=auth_headers)
        
        # Make 10 concurrent requests
        tasks = [make_request() for _ in range(10)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All should succeed (or fail consistently)
        status_codes = [r.status_code for r in responses if hasattr(r, 'status_code')]
        assert len(status_codes) == 10
        assert all(code in [200, 401, 403] for code in status_codes)
    
    async def test_large_payload_handling(self, client: AsyncClient, auth_headers, performance_test_data, mock_auth):
        """Test handling large payloads."""
        large_payload = {
            "leads": performance_test_data["bulk_leads"]  # 100 leads
        }
        
        response = await client.post(
            "/api/leads/bulk",
            headers=auth_headers,
            json=large_payload
        )
        
        # Should handle large payload gracefully
        assert response.status_code in [201, 413, 422]  # Created, too large, or validation error
    
    async def test_pagination_performance(self, client: AsyncClient, auth_headers, mock_auth):
        """Test pagination with large datasets."""
        response = await client.get(
            "/api/leads",
            headers=auth_headers,
            params={"page": 1, "per_page": 100}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["per_page"] == 100


if __name__ == "__main__":
    pytest.main([__file__, "-v"])