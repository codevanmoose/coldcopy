"""
ColdCopy Email Infrastructure
Comprehensive email sending and management system using Amazon SES
"""

from .ses_manager import SESManager, EmailMessage, EmailType, SESConfig
from .configuration_manager import ConfigurationSetManager
from .warmup_manager import WarmupManager, WarmupPhase
from .reputation_monitor import ReputationMonitor, ReputationMetrics
from .event_processor import EventProcessor, EmailEvent, EventType

__version__ = "1.0.0"

__all__ = [
    "SESManager",
    "EmailMessage", 
    "EmailType",
    "SESConfig",
    "ConfigurationSetManager",
    "WarmupManager",
    "WarmupPhase",
    "ReputationMonitor",
    "ReputationMetrics",
    "EventProcessor",
    "EmailEvent",
    "EventType"
]