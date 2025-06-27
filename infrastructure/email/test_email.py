#!/usr/bin/env python3
"""
Test email sending functionality
"""

import os
import sys
import asyncio
import logging
from dotenv import load_dotenv
from ses_manager import SESManager, EmailMessage, EmailType, SESConfig
import argparse
from datetime import datetime

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def send_test_email(recipient: str, email_type: str = "transactional"):
    """Send a test email"""
    
    # Create SES configuration
    config = SESConfig(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        primary_region=os.getenv('AWS_REGION', 'us-east-1'),
        backup_regions=os.getenv('AWS_BACKUP_REGIONS', 'eu-west-1').split(','),
        redis_url=os.getenv('REDIS_URL', 'redis://localhost:6379'),
        marketing_config_set=os.getenv('MARKETING_CONFIG_SET', 'coldcopy-marketing'),
        transactional_config_set=os.getenv('TRANSACTIONAL_CONFIG_SET', 'coldcopy-transactional'),
        tracking_domain=os.getenv('TRACKING_DOMAIN', 'track.coldcopy.ai'),
        tracking_pixel_url=os.getenv('TRACKING_PIXEL_URL', 'https://track.coldcopy.ai/pixel'),
        click_tracking_url=os.getenv('CLICK_TRACKING_URL', 'https://track.coldcopy.ai/click'),
        unsubscribe_url=os.getenv('UNSUBSCRIBE_URL', 'https://app.coldcopy.ai/unsubscribe')
    )
    
    # Create SES manager
    manager = SESManager(config)
    
    # Determine email type
    email_type_enum = EmailType.TRANSACTIONAL if email_type == "transactional" else EmailType.MARKETING
    
    # Create test email content
    if email_type == "transactional":
        subject = f"ColdCopy Test - Transactional Email {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        html_body = """
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
                .button { background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Test Transactional Email</h1>
                </div>
                <div class="content">
                    <p>Hi there,</p>
                    <p>This is a test transactional email from ColdCopy's email infrastructure.</p>
                    <p><strong>Test Details:</strong></p>
                    <ul>
                        <li>Email Type: Transactional</li>
                        <li>Configuration Set: {config_set}</li>
                        <li>Region: {region}</li>
                        <li>Timestamp: {timestamp}</li>
                    </ul>
                    <p>This email includes:</p>
                    <ul>
                        <li>Open tracking pixel</li>
                        <li>Click tracking on links</li>
                        <li>Unsubscribe header</li>
                    </ul>
                    <center>
                        <a href="https://coldcopy.ai" class="button">Visit ColdCopy</a>
                    </center>
                </div>
                <div class="footer">
                    <p>This is a test email. No action required.</p>
                </div>
            </div>
        </body>
        </html>
        """.format(
            config_set=config.transactional_config_set,
            region=config.primary_region,
            timestamp=datetime.now().isoformat()
        )
    else:
        subject = f"ColdCopy Test - Marketing Email {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        html_body = """
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
                .cta { background-color: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Test Marketing Email</h1>
                </div>
                <div class="content">
                    <h2>Boost Your Email Campaigns with ColdCopy!</h2>
                    <p>This is a test marketing email demonstrating our email infrastructure capabilities.</p>
                    <p><strong>Features being tested:</strong></p>
                    <ul>
                        <li>✅ Multi-region sending with failover</li>
                        <li>✅ Open and click tracking</li>
                        <li>✅ Automatic unsubscribe handling</li>
                        <li>✅ Bounce and complaint processing</li>
                        <li>✅ Marketing configuration set</li>
                    </ul>
                    <center>
                        <a href="https://coldcopy.ai/features" class="cta">Explore Features</a>
                    </center>
                    <p>This email was sent from region: <strong>{region}</strong></p>
                </div>
                <div class="footer">
                    <p>You're receiving this test email from ColdCopy.</p>
                    <p><a href="#">Unsubscribe</a> | <a href="#">Update Preferences</a></p>
                </div>
            </div>
        </body>
        </html>
        """.format(region=config.primary_region)
    
    text_body = "This is a test email from ColdCopy. Please view the HTML version for the best experience."
    
    # Create email message
    message = EmailMessage(
        to_addresses=[recipient],
        from_address=os.getenv('FROM_EMAIL', 'test@coldcopy.ai'),
        from_name=os.getenv('FROM_NAME', 'ColdCopy Test'),
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        email_type=email_type_enum,
        workspace_id="test-workspace-123",
        campaign_id="test-campaign-456",
        lead_id="test-lead-789",
        tags=["test", email_type, "infrastructure-test"]
    )
    
    # Send email
    logger.info(f"Sending {email_type} test email to {recipient}...")
    
    try:
        success, message_id = await manager.send_email(message)
        
        if success:
            logger.info(f"✅ Email sent successfully!")
            logger.info(f"   Message ID: {message_id}")
            logger.info(f"   Type: {email_type}")
            logger.info(f"   Recipient: {recipient}")
            
            # Check suppression status
            is_suppressed = await manager._is_suppressed(recipient)
            if is_suppressed:
                logger.warning(f"⚠️  Note: {recipient} is in the suppression list")
            
            return True
        else:
            logger.error(f"❌ Failed to send email: {message_id}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error sending email: {str(e)}")
        return False


async def test_bounce_simulator():
    """Test bounce handling with SES simulator"""
    logger.info("\n=== Testing Bounce Handling ===")
    
    success = await send_test_email("bounce@simulator.amazonses.com", "transactional")
    if success:
        logger.info("Bounce test email sent. Check event processor logs for bounce handling.")


async def test_complaint_simulator():
    """Test complaint handling with SES simulator"""
    logger.info("\n=== Testing Complaint Handling ===")
    
    success = await send_test_email("complaint@simulator.amazonses.com", "transactional")
    if success:
        logger.info("Complaint test email sent. Check event processor logs for complaint handling.")


async def test_suppression_list():
    """Test suppression list functionality"""
    logger.info("\n=== Testing Suppression List ===")
    
    config = SESConfig(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        redis_url=os.getenv('REDIS_URL', 'redis://localhost:6379')
    )
    
    manager = SESManager(config)
    
    # Add test email to suppression list
    test_email = "suppressed-test@example.com"
    await manager.add_to_suppression_list(test_email, "Test suppression")
    
    # Check if suppressed
    is_suppressed = await manager._is_suppressed(test_email)
    logger.info(f"Is {test_email} suppressed? {is_suppressed}")
    
    # Get suppression list
    suppression_list = await manager.get_suppression_list(page=1, per_page=10)
    logger.info(f"Suppression list contains {suppression_list['total']} emails")
    
    # Remove from suppression list
    await manager.remove_from_suppression_list(test_email)
    is_suppressed = await manager._is_suppressed(test_email)
    logger.info(f"After removal, is {test_email} suppressed? {is_suppressed}")


async def test_email_statistics():
    """Test email statistics retrieval"""
    logger.info("\n=== Email Statistics ===")
    
    config = SESConfig(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        redis_url=os.getenv('REDIS_URL', 'redis://localhost:6379')
    )
    
    manager = SESManager(config)
    
    stats = await manager.get_email_statistics()
    
    logger.info("Overall Statistics:")
    logger.info(f"  Sent Today: {stats['totals']['sent_today']}")
    logger.info(f"  Suppression List Size: {stats['totals']['suppression_list_size']}")
    
    for region, region_stats in stats['regions'].items():
        logger.info(f"\n{region} Statistics:")
        logger.info(f"  Bounce Rate: {region_stats.get('bounce_rate', 0):.2%}")
        logger.info(f"  Complaint Rate: {region_stats.get('complaint_rate', 0):.4%}")
        logger.info(f"  Total Sent: {region_stats.get('total_sent', 0)}")


async def main():
    """Main test function"""
    parser = argparse.ArgumentParser(description='Test ColdCopy email infrastructure')
    parser.add_argument('recipient', nargs='?', help='Email recipient')
    parser.add_argument('--type', choices=['transactional', 'marketing'], 
                       default='transactional', help='Email type to send')
    parser.add_argument('--test-bounce', action='store_true', 
                       help='Test bounce handling with SES simulator')
    parser.add_argument('--test-complaint', action='store_true',
                       help='Test complaint handling with SES simulator')
    parser.add_argument('--test-suppression', action='store_true',
                       help='Test suppression list functionality')
    parser.add_argument('--stats', action='store_true',
                       help='Show email statistics')
    
    args = parser.parse_args()
    
    if args.test_bounce:
        await test_bounce_simulator()
    elif args.test_complaint:
        await test_complaint_simulator()
    elif args.test_suppression:
        await test_suppression_list()
    elif args.stats:
        await test_email_statistics()
    elif args.recipient:
        success = await send_test_email(args.recipient, args.type)
        sys.exit(0 if success else 1)
    else:
        parser.print_help()
        logger.info("\nExamples:")
        logger.info("  python test_email.py user@example.com")
        logger.info("  python test_email.py user@example.com --type marketing")
        logger.info("  python test_email.py --test-bounce")
        logger.info("  python test_email.py --stats")


if __name__ == "__main__":
    asyncio.run(main())