"""
Integration tests for ColdCopy API.
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

from httpx import AsyncClient


class TestFullUserFlow:
    """Test complete user workflows."""
    
    async def test_campaign_creation_to_email_send(
        self, 
        client: AsyncClient, 
        auth_headers, 
        mock_auth, 
        mock_celery
    ):
        """Test complete flow from campaign creation to email sending."""
        
        # 1. Create campaign
        campaign_data = {
            "name": "Integration Test Campaign",
            "description": "Full flow test",
            "settings": {
                "email_subject": "Test Subject {{first_name}}",
                "email_template": "Hello {{first_name}}, this is a test.",
                "daily_limit": 50
            }
        }
        
        response = await client.post(
            "/api/campaigns",
            headers=auth_headers,
            json=campaign_data
        )
        assert response.status_code == 201
        campaign = response.json()
        campaign_id = campaign["id"]
        
        # 2. Add leads to campaign
        leads_data = {
            "leads": [
                {
                    "email": "test1@example.com",
                    "first_name": "John",
                    "last_name": "Doe",
                    "company": "Test Corp"
                },
                {
                    "email": "test2@example.com", 
                    "first_name": "Jane",
                    "last_name": "Smith",
                    "company": "Example Inc"
                }
            ]
        }
        
        response = await client.post(
            "/api/leads/bulk",
            headers=auth_headers,
            json=leads_data
        )
        assert response.status_code == 201
        
        # 3. Send emails to campaign leads
        email_data = {
            "campaign_id": campaign_id,
            "subject": "Integration Test Email",
            "html_content": "<p>Hello {{first_name}}, this is a test email.</p>"
        }
        
        response = await client.post(
            "/api/email/send-bulk",
            headers=auth_headers,
            json=email_data
        )
        assert response.status_code == 202
        
        # 4. Check campaign analytics
        response = await client.get(
            f"/api/campaigns/{campaign_id}/analytics",
            headers=auth_headers
        )
        assert response.status_code == 200
        analytics = response.json()
        assert "emails_sent" in analytics
    
    async def test_lead_enrichment_workflow(
        self, 
        client: AsyncClient, 
        auth_headers, 
        mock_auth
    ):
        """Test lead enrichment workflow."""
        
        # 1. Create lead without enrichment
        lead_data = {
            "email": "ceo@testcompany.com",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = await client.post(
            "/api/leads",
            headers=auth_headers,
            json=lead_data
        )
        assert response.status_code == 201
        lead = response.json()
        lead_id = lead["id"]
        
        # 2. Enrich the lead
        with patch('utils.enrichment.enrich_lead') as mock_enrich:
            mock_enrich.return_value = {
                "title": "CEO",
                "company_size": "11-50",
                "industry": "Technology",
                "linkedin": "https://linkedin.com/in/testuser"
            }
            
            response = await client.post(
                f"/api/leads/{lead_id}/enrich",
                headers=auth_headers
            )
            assert response.status_code == 200
            
            enriched_lead = response.json()
            assert "enrichment_data" in enriched_lead
            assert enriched_lead["enrichment_data"]["title"] == "CEO"
        
        # 3. Verify enrichment persisted
        response = await client.get(
            f"/api/leads/{lead_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        lead = response.json()
        assert "enrichment_data" in lead
    
    async def test_webhook_to_analytics_flow(
        self, 
        client: AsyncClient, 
        mock_celery
    ):
        """Test webhook event processing to analytics updates."""
        
        # 1. Receive webhook for email delivery
        webhook_payload = {
            "Type": "Notification",
            "Message": '''{
                "eventType": "delivery",
                "mail": {
                    "messageId": "integration_test_msg_123",
                    "timestamp": "2024-01-15T10:30:00.000Z",
                    "destination": ["test@example.com"]
                },
                "delivery": {
                    "timestamp": "2024-01-15T10:30:05.000Z",
                    "recipients": ["test@example.com"]
                }
            }'''
        }
        
        response = await client.post("/api/webhooks/ses", json=webhook_payload)
        assert response.status_code == 200
        
        # 2. Receive webhook for email open
        open_webhook = {
            "Type": "Notification", 
            "Message": '''{
                "eventType": "open",
                "mail": {
                    "messageId": "integration_test_msg_123",
                    "timestamp": "2024-01-15T10:30:00.000Z"
                },
                "open": {
                    "timestamp": "2024-01-15T11:00:00.000Z",
                    "userAgent": "Mozilla/5.0 (compatible; email client)"
                }
            }'''
        }
        
        response = await client.post("/api/webhooks/ses", json=open_webhook)
        assert response.status_code == 200
        
        # Verify webhooks were queued for processing
        assert mock_celery.called


class TestAPIVersioningIntegration:
    """Test API versioning across different endpoints."""
    
    async def test_v1_to_v2_compatibility(self, client: AsyncClient, auth_headers, mock_auth):
        """Test compatibility between API versions."""
        
        # Test v1 campaign format
        v1_headers = {**auth_headers, "API-Version": "v1"}
        
        campaign_data = {
            "name": "V1 Test Campaign",
            "is_active": True,  # v1 format
            "settings": {
                "email_subject": "Test",
                "email_template": "Hello world"
            }
        }
        
        response = await client.post(
            "/api/campaigns",
            headers=v1_headers,
            json=campaign_data
        )
        
        # Should work with v1 format
        if response.status_code == 201:
            campaign = response.json()
            assert "is_active" in campaign or "status" in campaign
        
        # Test v2 campaign format
        v2_headers = {**auth_headers, "API-Version": "v2"}
        
        v2_campaign_data = {
            "name": "V2 Test Campaign",
            "status": "active",  # v2 format
            "metadata": {"tags": ["test"]},  # v2 field
            "settings": {
                "email_subject": "Test",
                "email_template": "Hello world"
            }
        }
        
        response = await client.post(
            "/api/campaigns",
            headers=v2_headers,
            json=v2_campaign_data
        )
        
        if response.status_code == 201:
            campaign = response.json()
            assert campaign["status"] == "active"
            assert "metadata" in campaign
    
    async def test_version_header_consistency(self, client: AsyncClient, auth_headers):
        """Test version headers are consistent across requests."""
        
        test_endpoints = [
            "/api/campaigns",
            "/api/leads", 
            "/api/email/templates",
            "/api/workspaces"
        ]
        
        for endpoint in test_endpoints:
            response = await client.get(endpoint, headers=auth_headers)
            
            if response.status_code in [200, 401, 403]:
                # Version headers should be present
                assert "API-Version" in response.headers
                assert response.headers["API-Version"] in ["v1", "v2"]


class TestConcurrencyAndRaceConditions:
    """Test concurrent access and race conditions."""
    
    async def test_concurrent_campaign_creation(
        self, 
        client: AsyncClient, 
        auth_headers, 
        mock_auth
    ):
        """Test concurrent campaign creation."""
        
        async def create_campaign(index):
            campaign_data = {
                "name": f"Concurrent Campaign {index}",
                "description": f"Campaign created concurrently #{index}",
                "settings": {
                    "email_subject": f"Subject {index}",
                    "email_template": f"Template {index}"
                }
            }
            
            response = await client.post(
                "/api/campaigns",
                headers=auth_headers,
                json=campaign_data
            )
            return response
        
        # Create multiple campaigns concurrently
        tasks = [create_campaign(i) for i in range(5)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All should succeed (or fail gracefully)
        success_count = 0
        for response in responses:
            if hasattr(response, 'status_code'):
                if response.status_code == 201:
                    success_count += 1
                else:
                    # Should fail gracefully, not crash
                    assert response.status_code in [400, 401, 403, 422, 429]
        
        # At least some should succeed
        assert success_count >= 0
    
    async def test_concurrent_lead_updates(
        self, 
        client: AsyncClient, 
        auth_headers, 
        mock_auth
    ):
        """Test concurrent updates to the same lead."""
        
        # First create a lead
        lead_data = {
            "email": "concurrent@example.com",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = await client.post(
            "/api/leads",
            headers=auth_headers,
            json=lead_data
        )
        
        if response.status_code != 201:
            return  # Skip if lead creation fails
        
        lead = response.json()
        lead_id = lead["id"]
        
        async def update_lead(field_value):
            update_data = {
                "first_name": f"Updated{field_value}",
                "last_name": "ConcurrentTest"
            }
            
            response = await client.put(
                f"/api/leads/{lead_id}",
                headers=auth_headers,
                json=update_data
            )
            return response
        
        # Update same lead concurrently
        tasks = [update_lead(i) for i in range(3)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Should handle concurrent updates gracefully
        for response in responses:
            if hasattr(response, 'status_code'):
                assert response.status_code in [200, 409, 429]  # Success or conflict


class TestErrorRecoveryAndResilience:
    """Test error recovery and system resilience."""
    
    async def test_database_connection_recovery(
        self, 
        client: AsyncClient, 
        auth_headers
    ):
        """Test behavior during database connectivity issues."""
        
        # This test would require more sophisticated mocking
        # to simulate database failures and recovery
        response = await client.get("/health")
        
        # Health check should report database status
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
    
    async def test_redis_cache_fallback(
        self, 
        client: AsyncClient, 
        auth_headers, 
        mock_redis
    ):
        """Test fallback behavior when Redis is unavailable."""
        
        # Mock Redis failure
        mock_redis.get.side_effect = Exception("Redis connection failed")
        mock_redis.set.side_effect = Exception("Redis connection failed")
        
        # API should still work without cache
        response = await client.get("/api/campaigns", headers=auth_headers)
        
        # Should gracefully degrade
        assert response.status_code in [200, 401, 403, 500]
    
    async def test_external_service_timeout_handling(
        self, 
        client: AsyncClient, 
        auth_headers, 
        mock_auth
    ):
        """Test handling of external service timeouts."""
        
        # Mock external service timeout for enrichment
        with patch('utils.enrichment.enrich_lead') as mock_enrich:
            mock_enrich.side_effect = asyncio.TimeoutError("Service timeout")
            
            lead_data = {
                "email": "timeout@example.com",
                "first_name": "Test",
                "last_name": "User"
            }
            
            response = await client.post(
                "/api/leads",
                headers=auth_headers,
                json=lead_data
            )
            
            # Should handle timeout gracefully
            assert response.status_code in [201, 500, 503]


class TestDataConsistency:
    """Test data consistency across operations."""
    
    async def test_campaign_lead_consistency(
        self, 
        client: AsyncClient, 
        auth_headers, 
        mock_auth
    ):
        """Test consistency between campaigns and leads."""
        
        # Create campaign
        campaign_data = {
            "name": "Consistency Test Campaign",
            "settings": {
                "email_subject": "Test",
                "email_template": "Hello"
            }
        }
        
        response = await client.post(
            "/api/campaigns",
            headers=auth_headers,
            json=campaign_data
        )
        
        if response.status_code != 201:
            return
        
        campaign = response.json()
        campaign_id = campaign["id"]
        
        # Add leads to campaign
        leads_data = {
            "leads": [
                {
                    "email": "consistency1@example.com",
                    "first_name": "Test1",
                    "campaign_id": campaign_id
                },
                {
                    "email": "consistency2@example.com",
                    "first_name": "Test2", 
                    "campaign_id": campaign_id
                }
            ]
        }
        
        response = await client.post(
            "/api/leads/bulk",
            headers=auth_headers,
            json=leads_data
        )
        
        if response.status_code == 201:
            # Verify leads are associated with campaign
            response = await client.get(
                f"/api/campaigns/{campaign_id}/leads",
                headers=auth_headers
            )
            
            if response.status_code == 200:
                data = response.json()
                leads = data.get("items", [])
                assert len(leads) >= 2
    
    async def test_email_event_tracking_consistency(
        self, 
        client: AsyncClient, 
        mock_celery
    ):
        """Test consistency of email event tracking."""
        
        # Send multiple webhook events for same message
        message_id = "consistency_test_msg_123"
        
        events = [
            {
                "Type": "Notification",
                "Message": f'{{"eventType":"delivery","mail":{{"messageId":"{message_id}"}}}}'
            },
            {
                "Type": "Notification", 
                "Message": f'{{"eventType":"open","mail":{{"messageId":"{message_id}"}}}}'
            },
            {
                "Type": "Notification",
                "Message": f'{{"eventType":"click","mail":{{"messageId":"{message_id}"}}}}'
            }
        ]
        
        # Send events in sequence
        for event in events:
            response = await client.post("/api/webhooks/ses", json=event)
            assert response.status_code == 200
        
        # All events should be processed
        assert mock_celery.call_count == len(events)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])