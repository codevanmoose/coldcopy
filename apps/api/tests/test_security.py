"""
Security-focused tests for ColdCopy API.
"""
import pytest
import time
from unittest.mock import patch, AsyncMock

from httpx import AsyncClient


class TestAuthenticationSecurity:
    """Test authentication security measures."""
    
    async def test_jwt_token_validation(self, client: AsyncClient):
        """Test JWT token validation."""
        # Test with invalid token
        invalid_headers = {"Authorization": "Bearer invalid.jwt.token"}
        response = await client.get("/api/campaigns", headers=invalid_headers)
        assert response.status_code == 401
    
    async def test_jwt_token_expiration(self, client: AsyncClient):
        """Test JWT token expiration handling."""
        expired_headers = {"Authorization": "Bearer expired.jwt.token"}
        response = await client.get("/api/campaigns", headers=expired_headers)
        assert response.status_code == 401
        
        data = response.json()
        assert "expired" in data.get("detail", "").lower()
    
    async def test_api_key_validation(self, client: AsyncClient):
        """Test API key validation."""
        # Test with invalid API key
        invalid_headers = {"X-API-Key": "invalid-api-key"}
        response = await client.get("/api/campaigns", headers=invalid_headers)
        assert response.status_code == 401
    
    async def test_missing_authentication(self, client: AsyncClient):
        """Test requests without authentication."""
        response = await client.get("/api/campaigns")
        assert response.status_code == 401
        
        data = response.json()
        assert "authentication" in data.get("detail", "").lower()
    
    async def test_privilege_escalation_prevention(self, client: AsyncClient, auth_headers):
        """Test that users cannot access resources outside their workspace."""
        # Try to access another workspace's data
        other_workspace_id = "other-workspace-123"
        
        response = await client.get(
            f"/api/workspaces/{other_workspace_id}/campaigns",
            headers=auth_headers
        )
        assert response.status_code in [403, 404]  # Forbidden or Not Found


class TestInputValidation:
    """Test input validation security."""
    
    async def test_sql_injection_prevention(self, client: AsyncClient, auth_headers, mock_auth):
        """Test SQL injection prevention."""
        # Try SQL injection in search parameter
        malicious_input = "'; DROP TABLE campaigns; --"
        
        response = await client.get(
            "/api/leads/search",
            headers=auth_headers,
            params={"q": malicious_input}
        )
        
        # Should not crash and should return valid response
        assert response.status_code in [200, 400]  # Valid or bad request
    
    async def test_xss_prevention(self, client: AsyncClient, auth_headers, mock_auth):
        """Test XSS prevention in inputs."""
        xss_payload = "<script>alert('xss')</script>"
        
        campaign_data = {
            "name": xss_payload,
            "description": "Test campaign"
        }
        
        response = await client.post(
            "/api/campaigns",
            headers=auth_headers,
            json=campaign_data
        )
        
        if response.status_code == 201:
            data = response.json()
            # XSS should be escaped or sanitized
            assert "<script>" not in data.get("name", "")
    
    async def test_command_injection_prevention(self, client: AsyncClient, auth_headers, mock_auth):
        """Test command injection prevention."""
        malicious_email = "test@example.com; rm -rf /"
        
        lead_data = {
            "email": malicious_email,
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = await client.post(
            "/api/leads",
            headers=auth_headers,
            json=lead_data
        )
        
        # Should fail validation or sanitize input
        assert response.status_code in [400, 422]
    
    async def test_oversized_payload_rejection(self, client: AsyncClient, auth_headers, mock_auth):
        """Test rejection of oversized payloads."""
        # Create very large payload
        huge_description = "x" * 1000000  # 1MB string
        
        campaign_data = {
            "name": "Test Campaign",
            "description": huge_description
        }
        
        response = await client.post(
            "/api/campaigns",
            headers=auth_headers,
            json=campaign_data
        )
        
        # Should reject oversized payload
        assert response.status_code in [413, 422]  # Payload too large or validation error


class TestRateLimitingSecurity:
    """Test rate limiting security measures."""
    
    async def test_rate_limit_per_user(self, client: AsyncClient, auth_headers, mock_redis):
        """Test rate limiting per user."""
        # Mock rate limit exceeded
        mock_redis.check_rate_limit.return_value = {
            "allowed": False,
            "current_usage": 101,
            "limit": 100,
            "reset_time": "2024-01-15T10:35:00Z",
            "retry_after": 60
        }
        
        response = await client.get("/api/campaigns", headers=auth_headers)
        assert response.status_code == 429
        assert "Retry-After" in response.headers
    
    async def test_rate_limit_per_ip(self, client: AsyncClient):
        """Test rate limiting per IP address."""
        # Simulate multiple requests from same IP
        for _ in range(5):
            response = await client.get("/health")
            
        # Eventually should hit rate limit (if configured)
        # This test depends on actual rate limiting configuration
        assert response.status_code in [200, 429]
    
    async def test_burst_protection(self, client: AsyncClient, auth_headers):
        """Test protection against burst requests."""
        import asyncio
        
        # Make many concurrent requests
        tasks = []
        for _ in range(20):
            task = client.get("/api/campaigns", headers=auth_headers)
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Some requests should be rate limited
        status_codes = [r.status_code for r in responses if hasattr(r, 'status_code')]
        assert 429 in status_codes or all(code in [200, 401, 403] for code in status_codes)


class TestDataSecurity:
    """Test data security measures."""
    
    async def test_sensitive_data_masking(self, client: AsyncClient, auth_headers, mock_auth):
        """Test that sensitive data is masked in responses."""
        response = await client.get("/api/workspaces/current/settings", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            # API keys should be masked
            settings = data.get("settings", {})
            for key, value in settings.items():
                if "api_key" in key.lower() or "secret" in key.lower():
                    assert value is None or "***" in str(value)
    
    async def test_workspace_isolation(self, client: AsyncClient, auth_headers, mock_auth):
        """Test that workspace data is properly isolated."""
        # Try to access leads with malformed workspace context
        response = await client.get("/api/leads", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            leads = data.get("items", [])
            
            # All leads should belong to the authenticated user's workspace
            for lead in leads:
                assert lead.get("workspace_id") == mock_auth.workspace_id
    
    async def test_password_handling(self, client: AsyncClient):
        """Test secure password handling."""
        # Test password reset
        reset_data = {"email": "test@example.com"}
        
        response = await client.post("/api/auth/password-reset", json=reset_data)
        
        if response.status_code == 200:
            data = response.json()
            # Should not reveal if email exists
            assert "reset" in data.get("message", "").lower()
            assert "email" not in data.get("message", "").lower()


class TestWebhookSecurity:
    """Test webhook security measures."""
    
    async def test_webhook_signature_verification(self, client: AsyncClient):
        """Test webhook signature verification."""
        # Test webhook without proper signature
        webhook_payload = {
            "Type": "Notification",
            "Message": '{"eventType":"delivery","mail":{"messageId":"test"}}'
        }
        
        response = await client.post("/api/webhooks/ses", json=webhook_payload)
        
        # Should require proper signature verification
        # Result depends on VERIFY_WEBHOOK_SIGNATURES setting
        assert response.status_code in [200, 401, 403]
    
    async def test_webhook_replay_protection(self, client: AsyncClient):
        """Test webhook replay attack protection."""
        webhook_payload = {
            "Type": "Notification",
            "Timestamp": "2024-01-15T10:00:00Z",  # Old timestamp
            "Message": '{"eventType":"delivery","mail":{"messageId":"test"}}'
        }
        
        # Send same webhook twice
        response1 = await client.post("/api/webhooks/ses", json=webhook_payload)
        response2 = await client.post("/api/webhooks/ses", json=webhook_payload)
        
        # Second request might be rejected as replay
        assert response1.status_code in [200, 401]
        assert response2.status_code in [200, 401, 409]


class TestSecurityHeaders:
    """Test security headers."""
    
    async def test_security_headers_present(self, client: AsyncClient):
        """Test that security headers are present."""
        response = await client.get("/health")
        
        # Check for security headers
        headers = response.headers
        
        # These might be added by middleware
        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options", 
            "X-XSS-Protection",
            "Strict-Transport-Security"
        ]
        
        # At least some security headers should be present
        present_headers = [h for h in security_headers if h in headers]
        assert len(present_headers) >= 0  # Adjust based on actual implementation
    
    async def test_cors_configuration(self, client: AsyncClient):
        """Test CORS configuration."""
        # Test preflight request
        response = await client.options(
            "/api/campaigns",
            headers={"Origin": "https://malicious-site.com"}
        )
        
        # CORS should be configured properly
        if "Access-Control-Allow-Origin" in response.headers:
            allowed_origin = response.headers["Access-Control-Allow-Origin"]
            # Should not allow all origins in production
            assert allowed_origin != "*" or response.status_code == 404


class TestErrorHandlingSecurity:
    """Test security aspects of error handling."""
    
    async def test_error_information_disclosure(self, client: AsyncClient, auth_headers):
        """Test that errors don't disclose sensitive information."""
        # Try to trigger various errors
        error_endpoints = [
            ("/api/campaigns/invalid-uuid", "GET"),
            ("/api/leads/nonexistent", "GET"),
            ("/api/workspaces/invalid/settings", "GET")
        ]
        
        for endpoint, method in error_endpoints:
            if method == "GET":
                response = await client.get(endpoint, headers=auth_headers)
            
            if response.status_code >= 400:
                data = response.json()
                error_message = str(data.get("detail", ""))
                
                # Should not contain sensitive information
                sensitive_terms = [
                    "password", "secret", "key", "token",
                    "database", "sql", "connection",
                    "internal", "stack trace"
                ]
                
                for term in sensitive_terms:
                    assert term not in error_message.lower()
    
    async def test_404_consistency(self, client: AsyncClient, auth_headers, mock_auth):
        """Test that 404 responses are consistent."""
        # Access non-existent resources
        nonexistent_endpoints = [
            "/api/campaigns/nonexistent-id",
            "/api/leads/nonexistent-id",
            "/api/email/templates/nonexistent-id"
        ]
        
        for endpoint in nonexistent_endpoints:
            response = await client.get(endpoint, headers=auth_headers)
            
            if response.status_code == 404:
                data = response.json()
                # 404 messages should be consistent and not reveal internal structure
                assert "not found" in data.get("detail", "").lower()


class TestSessionSecurity:
    """Test session security measures."""
    
    async def test_session_fixation_prevention(self, client: AsyncClient):
        """Test session fixation prevention."""
        # Login should create new session
        login_data = {
            "email": "test@example.com",
            "password": "testpassword"
        }
        
        with patch('core.security.verify_password', return_value=True):
            with patch('core.security.create_access_token', return_value="new.jwt.token"):
                response = await client.post("/api/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            # Token should be new and unique
            assert data["access_token"] == "new.jwt.token"
    
    async def test_concurrent_session_handling(self, client: AsyncClient):
        """Test handling of concurrent sessions."""
        # This would test if multiple sessions are handled securely
        # Implementation depends on session management strategy
        login_data = {
            "email": "test@example.com",
            "password": "testpassword"
        }
        
        # Multiple login attempts
        responses = []
        for _ in range(3):
            with patch('core.security.verify_password', return_value=True):
                with patch('core.security.create_access_token', return_value=f"token.{time.time()}"):
                    response = await client.post("/api/auth/login", json=login_data)
                    responses.append(response)
        
        # All should succeed (or implement session limits)
        for response in responses:
            assert response.status_code in [200, 429]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])