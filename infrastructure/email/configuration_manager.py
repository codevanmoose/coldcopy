#!/usr/bin/env python3
"""
SES Configuration Set Manager
Manages configuration sets, event destinations, and reputation tracking
"""

import boto3
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import json
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ConfigurationSetConfig:
    """Configuration set settings"""
    name: str
    reputation_tracking: bool = True
    sending_enabled: bool = True
    event_types: List[str] = None
    sns_topic_arn: Optional[str] = None
    event_destination_name: str = "coldcopy-events"
    tags: Dict[str, str] = None


class ConfigurationSetManager:
    """Manages SES configuration sets across regions"""
    
    def __init__(self, aws_access_key_id: str, aws_secret_access_key: str):
        self.aws_access_key_id = aws_access_key_id
        self.aws_secret_access_key = aws_secret_access_key
        
    def _get_ses_client(self, region: str):
        """Get SES client for region"""
        return boto3.client(
            'ses',
            region_name=region,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key
        )
    
    def create_configuration_sets(self, regions: List[str]):
        """Create standard configuration sets in all regions"""
        configurations = [
            ConfigurationSetConfig(
                name="coldcopy-transactional",
                event_types=[
                    "send", "bounce", "complaint", "delivery", 
                    "reject", "open", "click", "renderingFailure"
                ],
                tags={"type": "transactional", "app": "coldcopy"}
            ),
            ConfigurationSetConfig(
                name="coldcopy-marketing",
                event_types=[
                    "send", "bounce", "complaint", "delivery",
                    "reject", "open", "click", "renderingFailure",
                    "subscription"
                ],
                tags={"type": "marketing", "app": "coldcopy"}
            )
        ]
        
        for region in regions:
            logger.info(f"Setting up configuration sets in {region}")
            client = self._get_ses_client(region)
            
            for config in configurations:
                try:
                    # Create configuration set
                    self._create_configuration_set(client, config)
                    
                    # Create event destination
                    self._create_event_destination(client, config)
                    
                    # Enable reputation tracking
                    if config.reputation_tracking:
                        self._enable_reputation_tracking(client, config.name)
                    
                    logger.info(f"Created configuration set {config.name} in {region}")
                    
                except client.exceptions.ConfigurationSetAlreadyExistsException:
                    logger.info(f"Configuration set {config.name} already exists in {region}")
                    # Update existing configuration
                    self._update_configuration_set(client, config)
                    
                except Exception as e:
                    logger.error(f"Failed to create configuration set {config.name} in {region}: {str(e)}")
    
    def _create_configuration_set(self, client: boto3.client, config: ConfigurationSetConfig):
        """Create a configuration set"""
        params = {
            'ConfigurationSet': {
                'Name': config.name
            }
        }
        
        client.put_configuration_set(**params)
        
        # Add tags if specified
        if config.tags:
            tags = [{'Key': k, 'Value': v} for k, v in config.tags.items()]
            client.put_configuration_set_tags(
                ConfigurationSetName=config.name,
                Tags=tags
            )
    
    def _create_event_destination(self, client: boto3.client, config: ConfigurationSetConfig):
        """Create event destination for configuration set"""
        if not config.event_types:
            return
        
        # For this example, we'll use a Kinesis Firehose destination
        # In production, you might use SNS, CloudWatch, or Kinesis
        event_destination = {
            'Name': config.event_destination_name,
            'Enabled': True,
            'MatchingEventTypes': config.event_types
        }
        
        # You would typically create a Kinesis Firehose stream first
        # For now, we'll use CloudWatch event destination
        event_destination['CloudWatchDestination'] = {
            'DimensionConfigurations': [
                {
                    'DimensionName': 'MessageTag',
                    'DimensionValueSource': 'messageTag',
                    'DefaultDimensionValue': 'none'
                },
                {
                    'DimensionName': 'ConfigurationSet',
                    'DimensionValueSource': 'configurationSet',
                    'DefaultDimensionValue': config.name
                }
            ]
        }
        
        try:
            client.put_configuration_set_event_destination(
                ConfigurationSetName=config.name,
                EventDestination=event_destination
            )
        except client.exceptions.EventDestinationAlreadyExistsException:
            # Update existing destination
            client.update_configuration_set_event_destination(
                ConfigurationSetName=config.name,
                EventDestination=event_destination
            )
    
    def _enable_reputation_tracking(self, client: boto3.client, configuration_set: str):
        """Enable reputation tracking for configuration set"""
        try:
            client.put_configuration_set_reputation_options(
                ConfigurationSetName=configuration_set,
                ReputationMetricsEnabled=True
            )
        except Exception as e:
            logger.error(f"Failed to enable reputation tracking: {str(e)}")
    
    def _update_configuration_set(self, client: boto3.client, config: ConfigurationSetConfig):
        """Update existing configuration set"""
        try:
            # Update event destination
            self._create_event_destination(client, config)
            
            # Update reputation tracking
            if config.reputation_tracking:
                self._enable_reputation_tracking(client, config.name)
                
        except Exception as e:
            logger.error(f"Failed to update configuration set: {str(e)}")
    
    def create_dedicated_ip_pool(self, region: str, pool_name: str):
        """Create dedicated IP pool for warm-up"""
        client = self._get_ses_client(region)
        
        try:
            client.put_dedicated_ip_pool(PoolName=pool_name)
            logger.info(f"Created dedicated IP pool: {pool_name}")
            
            # Tag the pool
            client.tag_resource(
                ResourceArn=f"arn:aws:ses:{region}:dedicated-ip-pool/{pool_name}",
                Tags=[
                    {'Key': 'app', 'Value': 'coldcopy'},
                    {'Key': 'purpose', 'Value': 'email-sending'}
                ]
            )
            
        except client.exceptions.AlreadyExistsException:
            logger.info(f"Dedicated IP pool {pool_name} already exists")
            
        except Exception as e:
            logger.error(f"Failed to create dedicated IP pool: {str(e)}")
    
    def configure_sending_authorization(self, region: str, identity: str, policy: Dict[str, Any]):
        """Configure sending authorization policy"""
        client = self._get_ses_client(region)
        
        try:
            client.put_identity_policy(
                Identity=identity,
                PolicyName='ColdCopySendingPolicy',
                Policy=json.dumps(policy)
            )
            logger.info(f"Configured sending authorization for {identity}")
            
        except Exception as e:
            logger.error(f"Failed to configure sending authorization: {str(e)}")
    
    def setup_custom_verification_template(self, region: str):
        """Create custom verification email template"""
        client = self._get_ses_client(region)
        
        template = {
            'TemplateName': 'ColdCopyVerification',
            'FromEmailAddress': 'verify@coldcopy.ai',
            'TemplateSubject': 'Verify your email for ColdCopy',
            'TemplateContent': '''
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
                    .button { background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Verify Your Email</h1>
                    </div>
                    <p>Hi there,</p>
                    <p>Please verify your email address to start using ColdCopy for your email campaigns.</p>
                    <center>
                        <a href="{{verificationLink}}" class="button">Verify Email</a>
                    </center>
                    <p>Or copy and paste this link:</p>
                    <p>{{verificationLink}}</p>
                    <p>This link expires in 24 hours.</p>
                    <p>Best regards,<br>The ColdCopy Team</p>
                </div>
            </body>
            </html>
            ''',
            'SuccessRedirectionURL': 'https://app.coldcopy.ai/verified',
            'FailureRedirectionURL': 'https://app.coldcopy.ai/verification-failed'
        }
        
        try:
            client.create_custom_verification_email_template(**template)
            logger.info("Created custom verification template")
            
        except client.exceptions.CustomVerificationEmailTemplateAlreadyExistsException:
            # Update existing template
            client.update_custom_verification_email_template(**template)
            logger.info("Updated custom verification template")
            
        except Exception as e:
            logger.error(f"Failed to create verification template: {str(e)}")
    
    def get_account_details(self, region: str) -> Dict[str, Any]:
        """Get SES account details and limits"""
        client = self._get_ses_client(region)
        
        try:
            # Get send quota
            quota = client.get_send_quota()
            
            # Get sending rate
            response = client.describe_configuration_set(
                ConfigurationSetName='coldcopy-transactional'
            )
            
            # Get verified identities
            identities = client.list_verified_email_addresses()
            
            # Get suppressed destinations
            suppressed = client.list_suppressed_destinations()
            
            return {
                'region': region,
                'quota': {
                    'max_24_hour_send': quota['Max24HourSend'],
                    'sent_last_24_hours': quota['SentLast24Hours'],
                    'max_send_rate': quota['MaxSendRate']
                },
                'verified_emails': identities['VerifiedEmailAddresses'],
                'suppressed_count': len(suppressed.get('SuppressedDestinationSummaries', [])),
                'sandbox_enabled': quota['Max24HourSend'] < 50000  # Assumption
            }
            
        except Exception as e:
            logger.error(f"Failed to get account details: {str(e)}")
            return {}
    
    def request_production_access(self, region: str, use_case: str, website_url: str,
                                monthly_volume: int, contact_email: str):
        """Submit request to move out of sandbox"""
        # This would typically be done through AWS Support
        # Here we'll log the details that would be submitted
        
        request = {
            'region': region,
            'use_case': use_case,
            'website_url': website_url,
            'monthly_volume': monthly_volume,
            'contact_email': contact_email,
            'compliance': {
                'double_opt_in': True,
                'unsubscribe_mechanism': True,
                'bounce_handling': True,
                'complaint_handling': True,
                'gdpr_compliant': True
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        logger.info(f"Production access request details: {json.dumps(request, indent=2)}")
        
        # In production, you would submit this through AWS Support API
        # or manually through the AWS Console
        
        return request


def setup_all_regions():
    """Setup configuration sets in all regions"""
    import os
    
    manager = ConfigurationSetManager(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )
    
    regions = ['us-east-1', 'eu-west-1']
    
    # Create configuration sets
    manager.create_configuration_sets(regions)
    
    # Create dedicated IP pools
    for region in regions:
        manager.create_dedicated_ip_pool(region, 'coldcopy-sending-pool')
        manager.setup_custom_verification_template(region)
        
        # Get account details
        details = manager.get_account_details(region)
        logger.info(f"Account details for {region}: {json.dumps(details, indent=2)}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    setup_all_regions()