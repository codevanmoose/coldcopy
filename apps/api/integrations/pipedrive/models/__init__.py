"""
Pipedrive integration models
"""
from .auth import PipedriveAuth, PipedriveTokenResponse
from .contacts import PipedrivePerson, PipedriveOrganization
from .deals import PipedriveDeal, PipedrivePipeline, PipedriveStage
from .activities import PipedriveActivity, PipedriveActivityType
from .webhooks import PipedriveWebhookEvent

__all__ = [
    "PipedriveAuth",
    "PipedriveTokenResponse",
    "PipedrivePerson",
    "PipedriveOrganization",
    "PipedriveDeal",
    "PipedrivePipeline",
    "PipedriveStage",
    "PipedriveActivity",
    "PipedriveActivityType",
    "PipedriveWebhookEvent",
]