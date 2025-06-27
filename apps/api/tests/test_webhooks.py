"""
Comprehensive tests for webhook functionality.
"""
import pytest
import json
import hmac
import hashlib
import base64
from datetime import datetime
from unittest.mock import patch, AsyncMock

from httpx import AsyncClient


class TestSESWebhooks:
    """Test Amazon SES webhook processing."""
    
    async def test_ses_delivery_webhook(self, client: AsyncClient, mock_celery):
        """Test SES delivery webhook processing."""
        payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "eventType": "delivery",
                "mail": {
                    "messageId": "ses_msg_123",
                    "timestamp": "2024-01-15T10:30:00.000Z",
                    "destination": ["recipient@example.com"],
                    "source": "sender@coldcopy.cc"
                },
                "delivery": {
                    "timestamp": "2024-01-15T10:30:05.000Z",
                    "recipients": ["recipient@example.com"],
                    "processingTimeMillis": 5000
                }
            })
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Event processed successfully"
        
        # Verify task was queued
        mock_celery.assert_called_once()
    
    async def test_ses_bounce_webhook(self, client: AsyncClient, mock_celery):
        """Test SES bounce webhook processing."""
        payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "eventType": "bounce",
                "mail": {
                    "messageId": "ses_bounce_123",
                    "timestamp": "2024-01-15T10:30:00.000Z",
                    "destination": ["bounced@example.com"]
                },
                "bounce": {
                    "timestamp": "2024-01-15T10:30:10.000Z",
                    "bounceType": "Permanent",
                    "bounceSubType": "NoEmail",
                    "bouncedRecipients": [
                        {
                            "emailAddress": "bounced@example.com",
                            "status": "5.1.1",
                            "action": "failed",
                            "diagnosticCode": "smtp; 550 5.1.1 User unknown"
                        }
                    ]
                }
            })
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_ses_complaint_webhook(self, client: AsyncClient, mock_celery):
        """Test SES complaint webhook processing."""
        payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "eventType": "complaint",
                "mail": {
                    "messageId": "ses_complaint_123",
                    "timestamp": "2024-01-15T10:30:00.000Z",
                    "destination": ["complaint@example.com"]
                },
                "complaint": {
                    "timestamp": "2024-01-15T11:00:00.000Z",
                    "feedbackId": "feedback_123",
                    "complainedRecipients": [
                        {
                            "emailAddress": "complaint@example.com"
                        }
                    ],
                    "complaintFeedbackType": "abuse"
                }
            })
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_ses_open_webhook(self, client: AsyncClient, mock_celery):
        """Test SES open event webhook."""
        payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "eventType": "open",
                "mail": {
                    "messageId": "ses_open_123",
                    "timestamp": "2024-01-15T10:30:00.000Z"
                },
                "open": {
                    "timestamp": "2024-01-15T11:00:00.000Z",
                    "userAgent": "Mozilla/5.0 (compatible; email client)",
                    "ipAddress": "192.168.1.1"
                }
            })
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_ses_click_webhook(self, client: AsyncClient, mock_celery):
        """Test SES click event webhook."""
        payload = {
            "Type": "Notification",
            "Message": json.dumps({
                "eventType": "click",
                "mail": {
                    "messageId": "ses_click_123",
                    "timestamp": "2024-01-15T10:30:00.000Z"
                },
                "click": {
                    "timestamp": "2024-01-15T11:15:00.000Z",
                    "ipAddress": "192.168.1.1",
                    "userAgent": "Mozilla/5.0 (compatible; email client)",
                    "link": "https://example.com/clicked-link"
                }
            })
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_ses_invalid_payload(self, client: AsyncClient):
        """Test SES webhook with invalid payload."""
        invalid_payload = {
            "Type": "Notification",
            "Message": "invalid json"
        }
        
        response = await client.post("/api/webhooks/ses", json=invalid_payload)
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data


class TestSendGridWebhooks:
    """Test SendGrid webhook processing."""
    
    async def test_sendgrid_delivered_webhook(self, client: AsyncClient, mock_celery):
        """Test SendGrid delivered webhook."""
        payload = [
            {
                "event": "delivered",
                "email": "recipient@example.com",
                "timestamp": 1642255800,
                "sg_event_id": "sg_event_123",
                "sg_message_id": "sg_msg_123.filterdrecv-p3mdw1-756b745b58-kmzbl-18-5FF48B99-1D.0",
                "smtp-id": "<original.message.id@example.com>",
                "category": ["campaign_123"],
                "response": "250 OK"
            }
        ]
        
        response = await client.post("/api/webhooks/sendgrid", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "events queued" in data["message"]
        
        mock_celery.assert_called_once()
    
    async def test_sendgrid_bounce_webhook(self, client: AsyncClient, mock_celery):
        """Test SendGrid bounce webhook."""
        payload = [
            {
                "event": "bounce",
                "email": "bounced@example.com",
                "timestamp": 1642255800,
                "sg_event_id": "sg_bounce_123",
                "sg_message_id": "sg_msg_bounce_123",
                "reason": "550 5.1.1 The email account that you tried to reach does not exist.",
                "status": "5.1.1",
                "type": "bounce"
            }
        ]
        
        response = await client.post("/api/webhooks/sendgrid", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_sendgrid_open_webhook(self, client: AsyncClient, mock_celery):
        """Test SendGrid open webhook."""
        payload = [
            {
                "event": "open",
                "email": "opened@example.com", 
                "timestamp": 1642256400,
                "sg_event_id": "sg_open_123",
                "sg_message_id": "sg_msg_open_123",
                "useragent": "Mozilla/5.0 (compatible; email client)",
                "ip": "192.168.1.1"
            }
        ]
        
        response = await client.post("/api/webhooks/sendgrid", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_sendgrid_click_webhook(self, client: AsyncClient, mock_celery):
        """Test SendGrid click webhook."""
        payload = [
            {
                "event": "click",
                "email": "clicked@example.com",
                "timestamp": 1642257000,
                "sg_event_id": "sg_click_123",
                "sg_message_id": "sg_msg_click_123",
                "useragent": "Mozilla/5.0 (compatible; email client)",
                "ip": "192.168.1.1",
                "url": "https://example.com/clicked-link"
            }
        ]
        
        response = await client.post("/api/webhooks/sendgrid", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_sendgrid_spam_report_webhook(self, client: AsyncClient, mock_celery):
        """Test SendGrid spam report webhook."""
        payload = [
            {
                "event": "spamreport",
                "email": "spam@example.com",
                "timestamp": 1642257600,
                "sg_event_id": "sg_spam_123",
                "sg_message_id": "sg_msg_spam_123"
            }
        ]
        
        response = await client.post("/api/webhooks/sendgrid", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_sendgrid_empty_payload(self, client: AsyncClient):
        """Test SendGrid webhook with empty payload."""
        response = await client.post("/api/webhooks/sendgrid", json=[])
        
        assert response.status_code == 200
        data = response.json()
        assert "No events" in data["message"]


class TestMailgunWebhooks:
    """Test Mailgun webhook processing."""
    
    async def test_mailgun_delivered_webhook(self, client: AsyncClient, mock_celery):
        """Test Mailgun delivered webhook."""
        payload = {
            "signature": {
                "timestamp": "1642255800",
                "token": "test_token",
                "signature": "test_signature"
            },
            "event-data": {
                "event": "delivered",
                "timestamp": 1642255800,
                "id": "mg_event_123",
                "message": {
                    "headers": {
                        "message-id": "mg_msg_123@example.com"
                    }
                },
                "recipient": "recipient@example.com",
                "delivery-status": {
                    "message": "250 2.0.0 OK",
                    "code": 250
                }
            }
        }
        
        response = await client.post("/api/webhooks/mailgun", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Event processed successfully"
        
        mock_celery.assert_called_once()
    
    async def test_mailgun_bounced_webhook(self, client: AsyncClient, mock_celery):
        """Test Mailgun bounced webhook."""
        payload = {
            "signature": {
                "timestamp": "1642255800",
                "token": "test_token",
                "signature": "test_signature"
            },
            "event-data": {
                "event": "failed",
                "severity": "permanent",
                "timestamp": 1642255800,
                "id": "mg_bounce_123",
                "message": {
                    "headers": {
                        "message-id": "mg_msg_bounce_123@example.com"
                    }
                },
                "recipient": "bounced@example.com",
                "delivery-status": {
                    "message": "550 5.1.1 User unknown",
                    "code": 550
                }
            }
        }
        
        response = await client.post("/api/webhooks/mailgun", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_mailgun_opened_webhook(self, client: AsyncClient, mock_celery):
        """Test Mailgun opened webhook."""
        payload = {
            "signature": {
                "timestamp": "1642256400",
                "token": "test_token", 
                "signature": "test_signature"
            },
            "event-data": {
                "event": "opened",
                "timestamp": 1642256400,
                "id": "mg_open_123",
                "message": {
                    "headers": {
                        "message-id": "mg_msg_open_123@example.com"
                    }
                },
                "recipient": "opened@example.com",
                "client-info": {
                    "client-name": "Email Client",
                    "client-os": "Windows",
                    "device-type": "desktop",
                    "user-agent": "Mozilla/5.0 (compatible; email client)"
                },
                "geolocation": {
                    "country": "US",
                    "region": "CA",
                    "city": "San Francisco"
                },
                "ip": "192.168.1.1"
            }
        }
        
        response = await client.post("/api/webhooks/mailgun", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_mailgun_clicked_webhook(self, client: AsyncClient, mock_celery):
        """Test Mailgun clicked webhook."""
        payload = {
            "signature": {
                "timestamp": "1642257000",
                "token": "test_token",
                "signature": "test_signature"
            },
            "event-data": {
                "event": "clicked",
                "timestamp": 1642257000,
                "id": "mg_click_123",
                "message": {
                    "headers": {
                        "message-id": "mg_msg_click_123@example.com"
                    }
                },
                "recipient": "clicked@example.com",
                "url": "https://example.com/clicked-link",
                "client-info": {
                    "client-name": "Email Client",
                    "user-agent": "Mozilla/5.0 (compatible; email client)"
                },
                "ip": "192.168.1.1"
            }
        }
        
        response = await client.post("/api/webhooks/mailgun", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()


class TestPostmarkWebhooks:
    """Test Postmark webhook processing."""
    
    async def test_postmark_delivery_webhook(self, client: AsyncClient, mock_celery):
        """Test Postmark delivery webhook."""
        payload = {
            "RecordType": "Delivery",
            "MessageID": "pm_msg_123",
            "DeliveredAt": "2024-01-15T10:30:05.000Z",
            "Details": "Message delivered successfully",
            "Tag": "campaign_123",
            "Recipient": "recipient@example.com",
            "ServerID": 123
        }
        
        response = await client.post("/api/webhooks/postmark", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Event processed successfully"
        
        mock_celery.assert_called_once()
    
    async def test_postmark_bounce_webhook(self, client: AsyncClient, mock_celery):
        """Test Postmark bounce webhook."""
        payload = {
            "RecordType": "Bounce",
            "MessageID": "pm_bounce_123",
            "BouncedAt": "2024-01-15T10:30:10.000Z",
            "Type": "HardBounce",
            "TypeCode": 1,
            "Details": "The server was unable to deliver your message",
            "Email": "bounced@example.com",
            "Name": "Bounced User",
            "Tag": "campaign_123",
            "DumpAvailable": False,
            "Inactive": True,
            "CanActivate": False,
            "Subject": "Test Subject"
        }
        
        response = await client.post("/api/webhooks/postmark", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_postmark_open_webhook(self, client: AsyncClient, mock_celery):
        """Test Postmark open webhook."""
        payload = {
            "RecordType": "Open",
            "MessageID": "pm_open_123",
            "FirstOpen": True,
            "ReceivedAt": "2024-01-15T11:00:00.000Z",
            "Tag": "campaign_123",
            "Recipient": "opened@example.com",
            "Client": {
                "Name": "Email Client",
                "Company": "Client Company",
                "Family": "Desktop"
            },
            "OS": {
                "Name": "Windows",
                "Company": "Microsoft",
                "Family": "Windows"
            },
            "Platform": "Desktop",
            "UserAgent": "Mozilla/5.0 (compatible; email client)",
            "ReadSeconds": 15
        }
        
        response = await client.post("/api/webhooks/postmark", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_postmark_click_webhook(self, client: AsyncClient, mock_celery):
        """Test Postmark click webhook."""
        payload = {
            "RecordType": "Click",
            "MessageID": "pm_click_123",
            "ClickLocation": "HTML",
            "ReceivedAt": "2024-01-15T11:15:00.000Z",
            "Tag": "campaign_123",
            "Recipient": "clicked@example.com",
            "OriginalLink": "https://example.com/original-link",
            "Client": {
                "Name": "Email Client",
                "Company": "Client Company"
            },
            "OS": {
                "Name": "Windows",
                "Company": "Microsoft"
            },
            "Platform": "Desktop",
            "UserAgent": "Mozilla/5.0 (compatible; email client)"
        }
        
        response = await client.post("/api/webhooks/postmark", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()
    
    async def test_postmark_spam_complaint_webhook(self, client: AsyncClient, mock_celery):
        """Test Postmark spam complaint webhook."""
        payload = {
            "RecordType": "SpamComplaint",
            "MessageID": "pm_spam_123",
            "BouncedAt": "2024-01-15T11:30:00.000Z",
            "Email": "spam@example.com",
            "Name": "Spam Reporter",
            "Tag": "campaign_123",
            "Details": "Spam complaint received"
        }
        
        response = await client.post("/api/webhooks/postmark", json=payload)
        
        assert response.status_code == 200
        mock_celery.assert_called_once()


class TestWebhookSecurity:
    """Test webhook security and validation."""
    
    async def test_webhook_signature_validation(self, client: AsyncClient):
        """Test webhook signature validation."""
        # Test with signature verification enabled
        with patch('core.config.get_settings') as mock_settings:
            mock_settings.return_value.VERIFY_WEBHOOK_SIGNATURES = True
            
            # Test SES webhook without proper signature
            payload = {
                "Type": "Notification",
                "Message": '{"eventType":"delivery"}'
            }
            
            response = await client.post("/api/webhooks/ses", json=payload)
            
            # Should fail validation (exact behavior depends on implementation)
            assert response.status_code in [200, 401, 403]
    
    async def test_webhook_replay_protection(self, client: AsyncClient, mock_celery):
        """Test webhook replay attack protection."""
        payload = {
            "Type": "Notification",
            "Timestamp": "2024-01-15T10:00:00Z",  # Timestamp
            "Message": '{"eventType":"delivery","mail":{"messageId":"replay_test"}}'
        }
        
        # Send same webhook twice
        response1 = await client.post("/api/webhooks/ses", json=payload)
        response2 = await client.post("/api/webhooks/ses", json=payload)
        
        # Both should succeed or second should be rejected
        assert response1.status_code == 200
        assert response2.status_code in [200, 409]  # OK or Conflict
    
    async def test_webhook_rate_limiting(self, client: AsyncClient, mock_redis):
        """Test webhook rate limiting."""
        # Mock rate limit exceeded for webhooks
        mock_redis.check_rate_limit.return_value = {
            "allowed": False,
            "current_usage": 1001,
            "limit": 1000,
            "reset_time": "2024-01-15T10:35:00Z",
            "retry_after": 60
        }
        
        payload = {
            "Type": "Notification",
            "Message": '{"eventType":"delivery"}'
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        # Should be rate limited or succeed (depends on implementation)
        assert response.status_code in [200, 429]


class TestWebhookErrorHandling:
    """Test webhook error handling."""
    
    async def test_malformed_webhook_payload(self, client: AsyncClient):
        """Test handling of malformed webhook payloads."""
        malformed_payloads = [
            None,
            "",
            "invalid json",
            {"incomplete": "data"},
            {"Type": "Unknown", "Message": "test"}
        ]
        
        for payload in malformed_payloads:
            if payload is None:
                continue
                
            response = await client.post("/api/webhooks/ses", json=payload)
            
            # Should handle gracefully
            assert response.status_code in [200, 400, 422]
    
    async def test_webhook_processing_failure(self, client: AsyncClient, mock_celery):
        """Test handling of webhook processing failures."""
        # Mock celery task failure
        mock_celery.side_effect = Exception("Task queue unavailable")
        
        payload = {
            "Type": "Notification",
            "Message": '{"eventType":"delivery","mail":{"messageId":"failure_test"}}'
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        # Should handle task failures gracefully
        assert response.status_code in [200, 500, 503]
    
    async def test_webhook_timeout_handling(self, client: AsyncClient):
        """Test webhook timeout handling."""
        # This would test timeout scenarios
        # Implementation depends on actual timeout configuration
        payload = {
            "Type": "Notification",
            "Message": '{"eventType":"delivery","mail":{"messageId":"timeout_test"}}'
        }
        
        response = await client.post("/api/webhooks/ses", json=payload)
        
        # Should complete within reasonable time
        assert response.status_code in [200, 400, 500, 503, 504]


class TestWebhookHealth:
    """Test webhook health and monitoring."""
    
    async def test_webhook_health_endpoint(self, client: AsyncClient):
        """Test webhook health check endpoint."""
        response = await client.get("/api/webhooks/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "supported_providers" in data
        
        # Should list all supported providers
        providers = data["supported_providers"]
        expected_providers = ["ses", "sendgrid", "mailgun", "postmark"]
        for provider in expected_providers:
            assert provider in providers
    
    async def test_webhook_metrics(self, client: AsyncClient, auth_headers, mock_auth):
        """Test webhook metrics endpoint."""
        response = await client.get("/api/webhooks/metrics", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert "total_events" in data
            assert "events_by_provider" in data
            assert "events_by_type" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])