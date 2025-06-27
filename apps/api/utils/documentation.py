"""
Automatic API documentation generation for different versions.
"""
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html

from core.versioning import version_registry, get_api_version_from_request

logger = logging.getLogger(__name__)


class DocumentationGenerator:
    """Generate version-specific API documentation."""
    
    def __init__(self, app: FastAPI):
        self.app = app
        self.base_title = "ColdCopy API"
        self.base_description = "AI-powered cold outreach automation platform"
        self.contact_info = {
            "name": "ColdCopy API Support",
            "email": "api-support@coldcopy.cc",
            "url": "https://docs.coldcopy.cc"
        }
        self.license_info = {
            "name": "Proprietary",
            "url": "https://coldcopy.cc/license"
        }
    
    def generate_openapi_schema(self, version: str = "v2") -> Dict[str, Any]:
        """Generate OpenAPI schema for a specific version."""
        
        version_info = version_registry.get_version(version)
        if not version_info:
            version_info = version_registry.get_version(version_registry.default_version)
        
        # Customize schema based on version
        title = f"{self.base_title} {version.upper()}"
        description = self._get_version_description(version)
        
        schema = get_openapi(
            title=title,
            version=version,
            description=description,
            routes=self.app.routes,
            contact=self.contact_info,
            license_info=self.license_info
        )
        
        # Add version-specific customizations
        schema = self._customize_schema_for_version(schema, version)
        
        return schema
    
    def _get_version_description(self, version: str) -> str:
        """Get description for specific API version."""
        descriptions = {
            "v1": f"""
{self.base_description}

## Version 1.0
This is the initial release of the ColdCopy API, providing core functionality for:
- Campaign management
- Lead management  
- Email sending
- Basic authentication
- GDPR compliance

### Getting Started
1. Register for an API key at https://app.coldcopy.cc
2. Include the API key in the Authorization header: `Bearer <your-api-key>`
3. Set the API version header: `API-Version: v1`

### Rate Limits
- 60 requests per minute
- 1000 requests per hour
- 10 email sends per minute

### Support
For API support, contact us at api-support@coldcopy.cc
            """,
            "v2": f"""
{self.base_description}

## Version 2.0
Enhanced version with advanced features and improved performance:
- Two-factor authentication
- Bulk operations
- CRM integrations (HubSpot, Pipedrive)
- Advanced rate limiting
- Real-time webhooks
- Enhanced analytics

### Breaking Changes from v1
⚠️ **Important**: Version 2 introduces breaking changes. See migration guide below.

- Campaign response format updated
- Authentication token format changed
- Error response structure modified
- Some endpoints deprecated

### New Features
- **Bulk Operations**: Process multiple records efficiently
- **CRM Integrations**: Sync with HubSpot and Pipedrive
- **Webhooks**: Real-time event notifications
- **Advanced Analytics**: Detailed campaign performance metrics
- **2FA Support**: Enhanced security with two-factor authentication

### Getting Started
1. Register for an API key at https://app.coldcopy.cc
2. Include the API key in the Authorization header: `Bearer <your-api-key>`
3. Set the API version header: `API-Version: v2`

### Rate Limits
- 100 requests per minute (Pro: 200, Enterprise: 500)
- 2000 requests per hour (Pro: 5000, Enterprise: 10000)
- 50 email sends per minute (Pro: 100, Enterprise: 200)
- Adaptive rate limiting based on user reputation

### Migration from v1
See the migration guide at `/api/versions/migration/guide?from_version=v1&to_version=v2`

### Support
For API support, contact us at api-support@coldcopy.cc
            """
        }
        
        return descriptions.get(version, descriptions["v2"])
    
    def _customize_schema_for_version(self, schema: Dict[str, Any], version: str) -> Dict[str, Any]:
        """Customize OpenAPI schema for specific version."""
        
        # Add version-specific servers
        schema["servers"] = [
            {
                "url": "https://api.coldcopy.cc",
                "description": "Production server"
            },
            {
                "url": "https://staging-api.coldcopy.cc", 
                "description": "Staging server"
            }
        ]
        
        # Add version info
        version_info = version_registry.get_version(version)
        if version_info:
            schema["info"]["x-api-version"] = version
            schema["info"]["x-release-date"] = version_info.release_date.isoformat()
            schema["info"]["x-status"] = version_info.status
            
            if version_info.deprecation_date:
                schema["info"]["x-deprecation-date"] = version_info.deprecation_date.isoformat()
            if version_info.sunset_date:
                schema["info"]["x-sunset-date"] = version_info.sunset_date.isoformat()
        
        # Add security schemes
        schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "JWT Bearer token authentication"
            },
            "ApiKeyAuth": {
                "type": "apiKey",
                "in": "header",
                "name": "X-API-Key",
                "description": "API key authentication"
            }
        }
        
        # Add global security requirement
        schema["security"] = [
            {"BearerAuth": []},
            {"ApiKeyAuth": []}
        ]
        
        # Add custom headers
        api_version_header = {
            "name": "API-Version",
            "in": "header",
            "required": False,
            "schema": {
                "type": "string",
                "enum": version_registry.get_supported_versions(),
                "default": version
            },
            "description": f"API version to use (default: {version})"
        }
        
        # Add version header to all operations
        for path in schema.get("paths", {}).values():
            for operation in path.values():
                if isinstance(operation, dict) and "parameters" in operation:
                    operation["parameters"].append(api_version_header)
                elif isinstance(operation, dict):
                    operation["parameters"] = [api_version_header]
        
        # Add version-specific examples
        schema = self._add_version_examples(schema, version)
        
        # Add tags for better organization
        schema["tags"] = [
            {
                "name": "authentication",
                "description": "Authentication and authorization endpoints"
            },
            {
                "name": "campaigns", 
                "description": "Campaign management operations"
            },
            {
                "name": "leads",
                "description": "Lead management and enrichment"
            },
            {
                "name": "email",
                "description": "Email sending and template management"
            },
            {
                "name": "integrations",
                "description": "CRM and third-party integrations",
                "x-version-added": "v2"
            },
            {
                "name": "webhooks",
                "description": "Webhook management and event handling",
                "x-version-added": "v2"
            },
            {
                "name": "analytics",
                "description": "Campaign analytics and reporting"
            },
            {
                "name": "gdpr",
                "description": "GDPR compliance and data management"
            },
            {
                "name": "system",
                "description": "System monitoring and health checks"
            }
        ]
        
        return schema
    
    def _add_version_examples(self, schema: Dict[str, Any], version: str) -> Dict[str, Any]:
        """Add version-specific examples to the schema."""
        
        examples = {
            "v1": {
                "Campaign": {
                    "id": "campaign_123",
                    "name": "Q1 Outreach",
                    "is_active": True,
                    "created_at": "2024-01-15T10:30:00Z"
                },
                "Lead": {
                    "id": "lead_456",
                    "email": "john@example.com",
                    "first_name": "John",
                    "last_name": "Doe",
                    "company": "Example Corp"
                }
            },
            "v2": {
                "Campaign": {
                    "id": "campaign_123",
                    "name": "Q1 Outreach",
                    "status": "active",
                    "metadata": {
                        "tags": ["enterprise", "tech"],
                        "source": "import"
                    },
                    "analytics": {
                        "emails_sent": 1250,
                        "open_rate": 23.5,
                        "click_rate": 4.2
                    },
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-20T15:45:00Z"
                },
                "Lead": {
                    "id": "lead_456",
                    "email": "john@example.com",
                    "full_name": "John Doe",
                    "company": "Example Corp",
                    "enrichment_data": {
                        "title": "VP of Sales",
                        "linkedin": "https://linkedin.com/in/johndoe",
                        "company_size": "51-200",
                        "industry": "Technology"
                    },
                    "engagement_score": 85,
                    "last_activity": "2024-01-18T09:15:00Z"
                }
            }
        }
        
        version_examples = examples.get(version, examples["v2"])
        
        # Add examples to schema components
        if "components" not in schema:
            schema["components"] = {}
        if "examples" not in schema["components"]:
            schema["components"]["examples"] = {}
        
        for model_name, example in version_examples.items():
            schema["components"]["examples"][f"{model_name}Example"] = {
                "summary": f"Example {model_name}",
                "value": example
            }
        
        return schema
    
    def generate_postman_collection(self, version: str = "v2") -> Dict[str, Any]:
        """Generate Postman collection for API version."""
        
        schema = self.generate_openapi_schema(version)
        
        collection = {
            "info": {
                "name": f"ColdCopy API {version.upper()}",
                "description": schema["info"]["description"],
                "version": version,
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "auth": {
                "type": "bearer",
                "bearer": [
                    {
                        "key": "token",
                        "value": "{{api_token}}",
                        "type": "string"
                    }
                ]
            },
            "variable": [
                {
                    "key": "base_url",
                    "value": "https://api.coldcopy.cc",
                    "type": "string"
                },
                {
                    "key": "api_version",
                    "value": version,
                    "type": "string"
                },
                {
                    "key": "api_token",
                    "value": "your_api_token_here",
                    "type": "string"
                }
            ],
            "item": []
        }
        
        # Convert OpenAPI paths to Postman requests
        for path, methods in schema.get("paths", {}).items():
            folder = {
                "name": path.split("/")[2] if len(path.split("/")) > 2 else "root",
                "item": []
            }
            
            for method, operation in methods.items():
                if method.lower() in ["get", "post", "put", "delete", "patch"]:
                    request = self._create_postman_request(path, method, operation, version)
                    folder["item"].append(request)
            
            if folder["item"]:
                collection["item"].append(folder)
        
        return collection
    
    def _create_postman_request(
        self, 
        path: str, 
        method: str, 
        operation: Dict[str, Any], 
        version: str
    ) -> Dict[str, Any]:
        """Create Postman request from OpenAPI operation."""
        
        request = {
            "name": operation.get("summary", f"{method.upper()} {path}"),
            "request": {
                "method": method.upper(),
                "header": [
                    {
                        "key": "API-Version",
                        "value": "{{api_version}}",
                        "type": "text"
                    },
                    {
                        "key": "Content-Type",
                        "value": "application/json",
                        "type": "text"
                    }
                ],
                "url": {
                    "raw": "{{base_url}}" + path,
                    "host": ["{{base_url}}"],
                    "path": path.split("/")[1:]
                }
            }
        }
        
        # Add request body if present
        if "requestBody" in operation:
            request_body = operation["requestBody"]
            if "application/json" in request_body.get("content", {}):
                json_schema = request_body["content"]["application/json"]["schema"]
                request["request"]["body"] = {
                    "mode": "raw",
                    "raw": json.dumps(self._generate_example_from_schema(json_schema), indent=2)
                }
        
        # Add description
        if "description" in operation:
            request["request"]["description"] = operation["description"]
        
        return request
    
    def _generate_example_from_schema(self, schema: Dict[str, Any]) -> Any:
        """Generate example data from JSON schema."""
        schema_type = schema.get("type", "object")
        
        if schema_type == "object":
            obj = {}
            properties = schema.get("properties", {})
            for prop_name, prop_schema in properties.items():
                obj[prop_name] = self._generate_example_from_schema(prop_schema)
            return obj
        elif schema_type == "array":
            items_schema = schema.get("items", {"type": "string"})
            return [self._generate_example_from_schema(items_schema)]
        elif schema_type == "string":
            return schema.get("example", "string")
        elif schema_type == "number":
            return schema.get("example", 0)
        elif schema_type == "integer":
            return schema.get("example", 0)
        elif schema_type == "boolean":
            return schema.get("example", True)
        else:
            return None
    
    def save_documentation(self, output_dir: str = "docs/api"):
        """Save documentation files for all versions."""
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        for version in version_registry.get_supported_versions():
            version_dir = output_path / version
            version_dir.mkdir(exist_ok=True)
            
            # Generate and save OpenAPI schema
            schema = self.generate_openapi_schema(version)
            with open(version_dir / "openapi.json", "w") as f:
                json.dump(schema, f, indent=2, default=str)
            
            # Generate and save Postman collection
            collection = self.generate_postman_collection(version)
            with open(version_dir / "postman_collection.json", "w") as f:
                json.dump(collection, f, indent=2, default=str)
            
            logger.info(f"Generated documentation for API version {version}")
        
        # Generate index file
        self._generate_index_file(output_path)
    
    def _generate_index_file(self, output_path: Path):
        """Generate index.html file with links to all versions."""
        
        versions = version_registry.get_all_versions()
        
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>ColdCopy API Documentation</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .version {{ margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }}
        .deprecated {{ border-color: #f0ad4e; background-color: #fcf8e3; }}
        .sunset {{ border-color: #d9534f; background-color: #f2dede; }}
        .active {{ border-color: #5cb85c; }}
        a {{ color: #337ab7; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
    </style>
</head>
<body>
    <h1>ColdCopy API Documentation</h1>
    <p>Choose an API version to view the documentation:</p>
    
    <div class="versions">
"""
        
        for version, info in sorted(versions.items()):
            status_class = info.status
            status_text = info.status.title()
            
            if info.status == "deprecated":
                status_text += f" (Sunset: {info.sunset_date.strftime('%Y-%m-%d') if info.sunset_date else 'TBD'})"
            
            html_content += f"""
        <div class="version {status_class}">
            <h3>API {version.upper()} - {status_text}</h3>
            <p>{info.changelog or 'No changelog available'}</p>
            <p><strong>Released:</strong> {info.release_date.strftime('%Y-%m-%d')}</p>
            <div>
                <a href="{version}/openapi.json">OpenAPI Schema</a> |
                <a href="{version}/postman_collection.json">Postman Collection</a>
            </div>
        </div>"""
        
        html_content += """
    </div>
    
    <h2>Migration Guides</h2>
    <ul>
        <li><a href="/api/versions/migration/guide?from_version=v1&to_version=v2">v1 to v2 Migration Guide</a></li>
    </ul>
    
    <h2>Getting Started</h2>
    <ol>
        <li>Register for an API key at <a href="https://app.coldcopy.cc">app.coldcopy.cc</a></li>
        <li>Choose an API version above</li>
        <li>Download the Postman collection or use the OpenAPI schema</li>
        <li>Set your API key in the Authorization header</li>
        <li>Set the API-Version header to your chosen version</li>
    </ol>
    
    <p>For support, contact <a href="mailto:api-support@coldcopy.cc">api-support@coldcopy.cc</a></p>
</body>
</html>
"""
        
        with open(output_path / "index.html", "w") as f:
            f.write(html_content)


# Global documentation generator instance
doc_generator = None

def get_documentation_generator(app: FastAPI) -> DocumentationGenerator:
    """Get or create documentation generator."""
    global doc_generator
    if doc_generator is None:
        doc_generator = DocumentationGenerator(app)
    return doc_generator