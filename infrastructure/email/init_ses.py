#!/usr/bin/env python3
"""
Initialize Amazon SES for ColdCopy
Sets up configuration sets, event destinations, and verified identities
"""

import os
import sys
import logging
from dotenv import load_dotenv
from configuration_manager import ConfigurationSetManager
import boto3
import json

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def initialize_ses():
    """Initialize SES in all regions"""
    
    # Get configuration
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    primary_region = os.getenv('AWS_REGION', 'us-east-1')
    backup_regions = os.getenv('AWS_BACKUP_REGIONS', 'eu-west-1').split(',')
    
    if not aws_access_key or not aws_secret_key:
        logger.error("AWS credentials not found in environment")
        sys.exit(1)
    
    # Initialize manager
    manager = ConfigurationSetManager(aws_access_key, aws_secret_key)
    
    all_regions = [primary_region] + backup_regions
    
    logger.info(f"Initializing SES in regions: {all_regions}")
    
    # Create configuration sets
    manager.create_configuration_sets(all_regions)
    
    # Set up dedicated IP pools
    for region in all_regions:
        try:
            manager.create_dedicated_ip_pool(region, 'coldcopy-sending-pool')
            manager.setup_custom_verification_template(region)
        except Exception as e:
            logger.error(f"Error setting up {region}: {str(e)}")
    
    # Verify sending domains
    domains = [
        os.getenv('FROM_DOMAIN', 'coldcopy.ai'),
        os.getenv('TRACKING_DOMAIN', 'track.coldcopy.ai')
    ]
    
    for region in all_regions:
        for domain in domains:
            verify_domain(manager, region, domain)
    
    # Set up SNS topics for event publishing
    setup_sns_topics(all_regions)
    
    # Display account status
    logger.info("\n=== SES Account Status ===")
    for region in all_regions:
        details = manager.get_account_details(region)
        logger.info(f"\n{region}:")
        logger.info(f"  Sending Quota: {details.get('quota', {}).get('max_24_hour_send', 0)}")
        logger.info(f"  Send Rate: {details.get('quota', {}).get('max_send_rate', 0)}/sec")
        logger.info(f"  Sandbox Mode: {details.get('sandbox_enabled', True)}")
        logger.info(f"  Verified Emails: {len(details.get('verified_emails', []))}")
    
    logger.info("\n✅ SES initialization complete!")
    
    # Production access reminder
    if any(details.get('sandbox_enabled', True) for details in [manager.get_account_details(r) for r in all_regions]):
        logger.warning("\n⚠️  Some regions are still in sandbox mode.")
        logger.warning("To request production access, run: python init_ses.py request-production")


def verify_domain(manager: ConfigurationSetManager, region: str, domain: str):
    """Verify a domain for sending"""
    try:
        client = manager._get_ses_client(region)
        
        # Verify domain
        response = client.verify_domain_identity(Domain=domain)
        verification_token = response['VerificationToken']
        
        logger.info(f"\nDomain verification initiated for {domain} in {region}")
        logger.info(f"Add this TXT record to your DNS:")
        logger.info(f"  Name: _amazonses.{domain}")
        logger.info(f"  Type: TXT")
        logger.info(f"  Value: {verification_token}")
        
        # Set up DKIM
        dkim_response = client.verify_domain_dkim(Domain=domain)
        dkim_tokens = dkim_response['DkimTokens']
        
        logger.info(f"\nDKIM records for {domain}:")
        for i, token in enumerate(dkim_tokens):
            logger.info(f"  Name: {token}._domainkey.{domain}")
            logger.info(f"  Type: CNAME")
            logger.info(f"  Value: {token}.dkim.amazonses.com")
        
        # Set up MAIL FROM domain
        mail_from_domain = f"mail.{domain}"
        client.put_identity_mail_from_domain_attributes(
            Identity=domain,
            MailFromDomain=mail_from_domain,
            BehaviorOnMxFailure='UseDefaultValue'
        )
        
        logger.info(f"\nMAIL FROM domain records for {domain}:")
        logger.info(f"  MX Record:")
        logger.info(f"    Name: {mail_from_domain}")
        logger.info(f"    Type: MX")
        logger.info(f"    Value: 10 feedback-smtp.{region}.amazonses.com")
        logger.info(f"  SPF Record:")
        logger.info(f"    Name: {mail_from_domain}")
        logger.info(f"    Type: TXT")
        logger.info(f"    Value: v=spf1 include:amazonses.com ~all")
        
    except Exception as e:
        logger.error(f"Failed to verify domain {domain} in {region}: {str(e)}")


def setup_sns_topics(regions: list):
    """Set up SNS topics for SES event publishing"""
    for region in regions:
        try:
            sns_client = boto3.client(
                'sns',
                region_name=region,
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
            )
            
            # Create topic for SES events
            topic_name = 'coldcopy-ses-events'
            response = sns_client.create_topic(Name=topic_name)
            topic_arn = response['TopicArn']
            
            logger.info(f"Created SNS topic in {region}: {topic_arn}")
            
            # Add webhook subscription if URL is provided
            webhook_url = os.getenv('SES_WEBHOOK_URL')
            if webhook_url:
                sns_client.subscribe(
                    TopicArn=topic_arn,
                    Protocol='https',
                    Endpoint=webhook_url
                )
                logger.info(f"Added webhook subscription: {webhook_url}")
            
        except Exception as e:
            logger.error(f"Failed to set up SNS in {region}: {str(e)}")


def request_production_access():
    """Generate production access request"""
    logger.info("\n=== SES Production Access Request ===")
    logger.info("\nTo request production access, submit a support case with:")
    
    request_template = {
        "use_case": "Transactional and marketing emails for ColdCopy platform",
        "sending_volume": {
            "daily": "50,000-100,000",
            "monthly": "1,500,000-3,000,000",
            "peak_hourly": "10,000"
        },
        "recipient_acquisition": "Double opt-in for marketing, explicit consent for transactional",
        "bounce_handling": "Automated suppression list, immediate unsubscribe",
        "complaint_handling": "Zero-tolerance policy, immediate suppression",
        "content_type": "B2B cold outreach, transactional notifications",
        "aws_services": ["SES", "SNS", "CloudWatch", "S3"],
        "compliance": {
            "gdpr": True,
            "can_spam": True,
            "unsubscribe_mechanism": "One-click unsubscribe in all emails",
            "data_retention": "90 days for bounces, permanent for complaints"
        }
    }
    
    logger.info(json.dumps(request_template, indent=2))
    logger.info("\nSubmit at: https://console.aws.amazon.com/support/home")


def create_test_data():
    """Create test configuration for development"""
    logger.info("\n=== Creating Test Data ===")
    
    # Add test email addresses
    test_emails = [
        "test@coldcopy.ai",
        "bounce@simulator.amazonses.com",
        "complaint@simulator.amazonses.com",
        "success@simulator.amazonses.com"
    ]
    
    ses_client = boto3.client(
        'ses',
        region_name=os.getenv('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )
    
    for email in test_emails:
        try:
            ses_client.verify_email_identity(EmailAddress=email)
            logger.info(f"Verification email sent to: {email}")
        except Exception as e:
            logger.error(f"Failed to verify {email}: {str(e)}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Initialize SES for ColdCopy')
    parser.add_argument('command', nargs='?', default='init',
                       choices=['init', 'request-production', 'test-data'],
                       help='Command to run')
    
    args = parser.parse_args()
    
    if args.command == 'init':
        initialize_ses()
    elif args.command == 'request-production':
        request_production_access()
    elif args.command == 'test-data':
        create_test_data()