"""
Tests for API versioning functionality.
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from fastapi import Request, FastAPI
from fastapi.testclient import TestClient

from core.versioning import (
    VersionRegistry,
    VersionExtractor,
    VersionMiddleware,
    VersioningStrategy,
    APIVersion,
    version,
    deprecated,
    require_version,
    VersionCompatibility
)
from utils.documentation import DocumentationGenerator


class TestVersionRegistry:
    """Test the version registry."""
    
    @pytest.fixture
    def registry(self):
        """Create a clean version registry."""
        return VersionRegistry()
    
    def test_register_version(self, registry):
        """Test version registration."""
        version_info = APIVersion(
            version="v3",
            release_date=datetime(2024, 12, 1),
            status="active",
            changelog="Test version"
        )
        
        registry.register_version(version_info)
        
        assert "v3" in registry.versions
        assert registry.get_version("v3") == version_info
    
    def test_get_supported_versions(self, registry):
        """Test getting supported versions."""
        supported = registry.get_supported_versions()
        
        # Should include active and deprecated versions
        assert "v1" in supported
        assert "v2" in supported
        
        # Add a sunset version
        registry.sunset_version("v1")
        supported_after_sunset = registry.get_supported_versions()
        assert "v1" not in supported_after_sunset
    
    def test_deprecate_version(self, registry):
        """Test version deprecation."""
        deprecation_date = datetime(2024, 6, 1)
        sunset_date = datetime(2024, 12, 1)
        
        registry.deprecate_version("v1", deprecation_date, sunset_date)
        
        version_info = registry.get_version("v1")
        assert version_info.status == "deprecated"
        assert version_info.deprecation_date == deprecation_date
        assert version_info.sunset_date == sunset_date
    
    def test_sunset_version(self, registry):
        """Test version sunset."""
        registry.sunset_version("v1")
        
        version_info = registry.get_version("v1")
        assert version_info.status == "sunset"
        assert not registry.is_version_supported("v1")
    
    def test_get_version_headers(self, registry):
        """Test version header generation."""
        headers = registry.get_version_headers("v2")
        
        assert headers["API-Version"] == "v2"
        assert headers["API-Version-Latest"] == "v2"
        assert "v1,v2" in headers["API-Supported-Versions"]
        
        # Test deprecated version headers
        registry.deprecate_version("v1", datetime(2024, 6, 1), datetime(2024, 12, 1))
        deprecated_headers = registry.get_version_headers("v1")
        
        assert "API-Deprecation-Date" in deprecated_headers
        assert "API-Sunset-Date" in deprecated_headers
        assert "Warning" in deprecated_headers


class TestVersionExtractor:
    """Test version extraction strategies."""
    
    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock()
        request.headers = {}
        request.url.path = "/api/campaigns"
        request.query_params = {}
        return request
    
    def test_extract_from_header(self, mock_request):
        """Test header-based version extraction."""
        extractor = VersionExtractor(VersioningStrategy.HEADER)
        
        # Test with header present
        mock_request.headers = {"API-Version": "v2"}
        version = extractor.extract_version(mock_request)
        assert version == "v2"
        
        # Test with no header (should use default)
        mock_request.headers = {}
        version = extractor.extract_version(mock_request)
        assert version == "v1"  # default
    
    def test_extract_from_url_path(self, mock_request):
        """Test URL path-based version extraction."""
        extractor = VersionExtractor(VersioningStrategy.URL_PATH)
        
        # Test with version in path
        mock_request.url.path = "/api/v2/campaigns"
        version = extractor.extract_version(mock_request)
        assert version == "v2"
        
        # Test without version in path
        mock_request.url.path = "/api/campaigns"
        version = extractor.extract_version(mock_request)
        assert version == "v1"  # default
    
    def test_extract_from_query_param(self, mock_request):
        """Test query parameter-based version extraction."""
        extractor = VersionExtractor(VersioningStrategy.QUERY_PARAM)
        
        # Test with query parameter
        mock_request.query_params = {"version": "v2"}
        version = extractor.extract_version(mock_request)
        assert version == "v2"
        
        # Test without query parameter
        mock_request.query_params = {}
        version = extractor.extract_version(mock_request)
        assert version == "v1"  # default
    
    def test_extract_from_accept_header(self, mock_request):
        """Test Accept header-based version extraction."""
        extractor = VersionExtractor(VersioningStrategy.ACCEPT_HEADER)
        
        # Test with versioned Accept header
        mock_request.headers = {"Accept": "application/vnd.coldcopy.v2+json"}
        version = extractor.extract_version(mock_request)
        assert version == "v2"
        
        # Test with standard Accept header
        mock_request.headers = {"Accept": "application/json"}
        version = extractor.extract_version(mock_request)
        assert version == "v1"  # default


class TestVersionMiddleware:
    """Test version middleware."""
    
    @pytest.fixture
    def registry(self):
        """Create version registry."""
        return VersionRegistry()
    
    @pytest.fixture
    def extractor(self):
        """Create version extractor."""
        return VersionExtractor(VersioningStrategy.HEADER)
    
    @pytest.fixture
    def middleware(self, registry, extractor):
        """Create version middleware."""
        return VersionMiddleware(registry, extractor, strict_mode=False)
    
    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock()
        request.headers = {"API-Version": "v2"}
        request.state = MagicMock()
        return request
    
    @pytest.mark.asyncio
    async def test_middleware_sets_version(self, middleware, mock_request):
        """Test that middleware sets version in request state."""
        async def call_next(request):
            # Verify version was set
            assert hasattr(request.state, 'api_version')
            assert request.state.api_version == "v2"
            
            response = MagicMock()
            response.headers = {}
            return response
        
        response = await middleware(mock_request, call_next)
        
        # Verify version headers were added
        assert "API-Version" in response.headers
        assert response.headers["API-Version"] == "v2"
    
    @pytest.mark.asyncio
    async def test_middleware_strict_mode(self, registry, extractor):
        """Test middleware in strict mode."""
        middleware = VersionMiddleware(registry, extractor, strict_mode=True)
        
        mock_request = MagicMock()
        mock_request.headers = {"API-Version": "v99"}  # Invalid version
        
        async def call_next(request):
            return MagicMock()
        
        with pytest.raises(Exception):  # Should raise HTTPException
            await middleware(mock_request, call_next)
    
    @pytest.mark.asyncio
    async def test_middleware_sunset_version(self, middleware, mock_request, registry):
        """Test middleware handling of sunset versions."""
        # Sunset v2
        registry.sunset_version("v2")
        
        async def call_next(request):
            return MagicMock()
        
        with pytest.raises(Exception):  # Should raise HTTPException for sunset version
            await middleware(mock_request, call_next)


class TestVersionCompatibility:
    """Test version compatibility system."""
    
    @pytest.fixture
    def compatibility(self):
        """Create version compatibility instance."""
        return VersionCompatibility()
    
    def test_register_transformer(self, compatibility):
        """Test transformer registration."""
        def dummy_transformer(data, direction):
            return data
        
        compatibility.register_transformer("v1", "v2", dummy_transformer)
        
        assert "v1" in compatibility.transformers
        assert "v2" in compatibility.transformers["v1"]
    
    def test_transform_request(self, compatibility):
        """Test request data transformation."""
        def test_transformer(data, direction):
            if direction == "request" and "old_field" in data:
                data["new_field"] = data.pop("old_field")
            return data
        
        compatibility.register_transformer("v1", "v2", test_transformer)
        
        input_data = {"old_field": "value", "other": "data"}
        result = compatibility.transform_request(input_data, "v1", "v2")
        
        assert "new_field" in result
        assert "old_field" not in result
        assert result["new_field"] == "value"
    
    def test_transform_response(self, compatibility):
        """Test response data transformation."""
        def test_transformer(data, direction):
            if direction == "response":
                data["transformed"] = True
            return data
        
        compatibility.register_transformer("v1", "v2", test_transformer)
        
        input_data = {"original": "data"}
        result = compatibility.transform_response(input_data, "v1", "v2")
        
        assert result["transformed"] is True
        assert result["original"] == "data"


class TestVersionDecorators:
    """Test version decorators."""
    
    def test_version_decorator(self):
        """Test version decorator."""
        @version("v2")
        def test_function():
            return "result"
        
        assert hasattr(test_function, '_api_version')
        assert test_function._api_version == "v2"
    
    def test_deprecated_decorator(self):
        """Test deprecated decorator."""
        @deprecated("2024-12-31", "Use new endpoint instead")
        def test_function():
            return "result"
        
        assert hasattr(test_function, '_deprecated')
        assert test_function._deprecated is True
        assert test_function._sunset_date == "2024-12-31"
        assert test_function._migration_guide == "Use new endpoint instead"
    
    @pytest.mark.asyncio
    async def test_require_version_decorator(self):
        """Test require_version decorator."""
        @require_version("v2")
        async def test_function(request):
            return "result"
        
        # Test with compatible version
        mock_request = MagicMock()
        mock_request.state.api_version = "v2"
        
        result = await test_function(mock_request)
        assert result == "result"
        
        # Test with incompatible version
        mock_request.state.api_version = "v1"
        
        with pytest.raises(Exception):  # Should raise HTTPException
            await test_function(mock_request)


class TestDocumentationGenerator:
    """Test documentation generation."""
    
    @pytest.fixture
    def app(self):
        """Create FastAPI app."""
        return FastAPI()
    
    @pytest.fixture
    def doc_generator(self, app):
        """Create documentation generator."""
        return DocumentationGenerator(app)
    
    def test_generate_openapi_schema(self, doc_generator):
        """Test OpenAPI schema generation."""
        schema = doc_generator.generate_openapi_schema("v2")
        
        assert schema["info"]["title"] == "ColdCopy API V2"
        assert schema["info"]["version"] == "v2"
        assert "servers" in schema
        assert "components" in schema
        assert "securitySchemes" in schema["components"]
    
    def test_generate_postman_collection(self, doc_generator):
        """Test Postman collection generation."""
        collection = doc_generator.generate_postman_collection("v2")
        
        assert collection["info"]["name"] == "ColdCopy API V2"
        assert collection["info"]["version"] == "v2"
        assert "auth" in collection
        assert collection["auth"]["type"] == "bearer"
        assert "variable" in collection
    
    def test_version_description(self, doc_generator):
        """Test version-specific descriptions."""
        v1_desc = doc_generator._get_version_description("v1")
        v2_desc = doc_generator._get_version_description("v2")
        
        assert "Version 1.0" in v1_desc
        assert "Version 2.0" in v2_desc
        assert "Breaking Changes" in v2_desc
        assert "New Features" in v2_desc
    
    def test_schema_customization(self, doc_generator):
        """Test schema customization for versions."""
        base_schema = {
            "info": {"title": "Test API"},
            "components": {},
            "paths": {}
        }
        
        customized = doc_generator._customize_schema_for_version(base_schema, "v2")
        
        assert "securitySchemes" in customized["components"]
        assert "security" in customized
        assert "tags" in customized
        assert customized["info"]["x-api-version"] == "v2"


class TestIntegration:
    """Integration tests for versioning system."""
    
    @pytest.fixture
    def app(self):
        """Create test FastAPI app with versioning."""
        app = FastAPI()
        
        from core.versioning import VersionMiddleware, version_registry, version_extractor
        
        app.add_middleware(
            VersionMiddleware,
            registry=version_registry,
            extractor=version_extractor,
            strict_mode=False
        )
        
        @app.get("/api/test")
        async def test_endpoint(request: Request):
            from core.versioning import get_api_version_from_request
            version = get_api_version_from_request(request)
            return {"version": version, "message": "test"}
        
        return app
    
    def test_version_header_integration(self, app):
        """Test full integration with version headers."""
        client = TestClient(app)
        
        # Test with v2 header
        response = client.get("/api/test", headers={"API-Version": "v2"})
        assert response.status_code == 200
        assert response.json()["version"] == "v2"
        assert response.headers["API-Version"] == "v2"
        
        # Test with v1 header
        response = client.get("/api/test", headers={"API-Version": "v1"})
        assert response.status_code == 200
        assert response.json()["version"] == "v1"
        assert response.headers["API-Version"] == "v1"
        
        # Test without header (should default to v1)
        response = client.get("/api/test")
        assert response.status_code == 200
        assert response.json()["version"] == "v1"
    
    def test_unsupported_version_handling(self, app):
        """Test handling of unsupported versions."""
        client = TestClient(app)
        
        # Test with unsupported version (should fallback to default)
        response = client.get("/api/test", headers={"API-Version": "v99"})
        assert response.status_code == 200
        assert response.json()["version"] == "v1"  # Fallback to default


if __name__ == "__main__":
    pytest.main([__file__])