"""
Advanced rate limiting utilities for ColdCopy API.
"""
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from core.redis import get_rate_limit_cache
from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimitType(Enum):
    """Types of rate limits."""
    REQUESTS_PER_SECOND = "rps"
    REQUESTS_PER_MINUTE = "rpm"
    REQUESTS_PER_HOUR = "rph"
    REQUESTS_PER_DAY = "rpd"
    TOKENS_PER_MINUTE = "tpm"
    BANDWIDTH_PER_SECOND = "bps"


@dataclass
class RateLimitConfig:
    """Rate limit configuration."""
    limit: int
    window_seconds: int
    burst_limit: Optional[int] = None
    description: str = ""
    
    @property
    def window_type(self) -> str:
        """Get human-readable window type."""
        if self.window_seconds <= 60:
            return f"{self.window_seconds}s"
        elif self.window_seconds <= 3600:
            return f"{self.window_seconds // 60}m"
        elif self.window_seconds <= 86400:
            return f"{self.window_seconds // 3600}h"
        else:
            return f"{self.window_seconds // 86400}d"


@dataclass
class RateLimitStatus:
    """Rate limit status response."""
    allowed: bool
    current_usage: int
    limit: int
    window_seconds: int
    remaining: int
    reset_time: str
    retry_after: Optional[int] = None
    error_message: Optional[str] = None


class AdaptiveRateLimiter:
    """
    Adaptive rate limiter that adjusts limits based on system load and user behavior.
    """
    
    def __init__(self):
        self.base_configs = {
            "email_send": RateLimitConfig(10, 60, burst_limit=20, description="Email sending"),
            "api_call": RateLimitConfig(100, 60, burst_limit=150, description="API calls"),
            "auth_attempt": RateLimitConfig(5, 300, description="Authentication attempts"),
            "webhook": RateLimitConfig(1000, 60, description="Webhook processing")
        }
        
        self.system_load_thresholds = {
            "low": 0.3,     # < 30% load
            "medium": 0.7,  # < 70% load
            "high": 1.0     # >= 70% load
        }
    
    async def check_adaptive_limit(
        self,
        identifier: str,
        limit_type: str,
        user_reputation: float = 1.0,
        system_load: float = 0.5
    ) -> RateLimitStatus:
        """Check rate limit with adaptive adjustments."""
        
        base_config = self.base_configs.get(limit_type)
        if not base_config:
            raise ValueError(f"Unknown rate limit type: {limit_type}")
        
        # Calculate adaptive limit
        adaptive_limit = await self._calculate_adaptive_limit(
            base_config, user_reputation, system_load
        )
        
        # Check rate limit with adaptive values
        rate_cache = await get_rate_limit_cache()
        result = await rate_cache.check_rate_limit(
            identifier,
            adaptive_limit.limit,
            adaptive_limit.window_seconds,
            1  # cost
        )
        
        return RateLimitStatus(
            allowed=result["allowed"],
            current_usage=result["current_usage"],
            limit=adaptive_limit.limit,
            window_seconds=adaptive_limit.window_seconds,
            remaining=max(0, adaptive_limit.limit - result["current_usage"]),
            reset_time=result["reset_time"],
            retry_after=result.get("retry_after"),
            error_message=result.get("error_message")
        )
    
    async def _calculate_adaptive_limit(
        self,
        base_config: RateLimitConfig,
        user_reputation: float,
        system_load: float
    ) -> RateLimitConfig:
        """Calculate adaptive limit based on user reputation and system load."""
        
        # User reputation adjustment (0.5 to 2.0 multiplier)
        reputation_multiplier = max(0.5, min(2.0, user_reputation))
        
        # System load adjustment (0.3 to 1.0 multiplier)
        if system_load < self.system_load_thresholds["low"]:
            load_multiplier = 1.0  # No reduction
        elif system_load < self.system_load_thresholds["medium"]:
            load_multiplier = 0.7  # 30% reduction
        else:
            load_multiplier = 0.3  # 70% reduction
        
        # Calculate final limit
        final_limit = int(base_config.limit * reputation_multiplier * load_multiplier)
        
        return RateLimitConfig(
            limit=max(1, final_limit),  # At least 1 request
            window_seconds=base_config.window_seconds,
            burst_limit=base_config.burst_limit,
            description=f"{base_config.description} (adaptive)"
        )


class DistributedRateLimiter:
    """
    Distributed rate limiter for multi-instance deployments.
    """
    
    def __init__(self, node_id: str = "default"):
        self.node_id = node_id
        self.coordination_key_prefix = "distributed_limit"
    
    async def check_distributed_limit(
        self,
        identifier: str,
        global_limit: int,
        window_seconds: int,
        node_count: int = 1
    ) -> RateLimitStatus:
        """Check rate limit across distributed nodes."""
        
        # Calculate per-node limit (with some overlap for burst handling)
        per_node_limit = max(1, int(global_limit / node_count * 1.2))
        
        rate_cache = await get_rate_limit_cache()
        
        # Check local node limit first
        local_result = await rate_cache.check_rate_limit(
            f"local:{self.node_id}:{identifier}",
            per_node_limit,
            window_seconds,
            1
        )
        
        if not local_result["allowed"]:
            return RateLimitStatus(
                allowed=False,
                current_usage=local_result["current_usage"],
                limit=per_node_limit,
                window_seconds=window_seconds,
                remaining=0,
                reset_time=local_result["reset_time"],
                retry_after=local_result.get("retry_after"),
                error_message="Local node limit exceeded"
            )
        
        # Check global limit across all nodes
        global_usage = await self._get_global_usage(identifier, window_seconds)
        
        if global_usage >= global_limit:
            return RateLimitStatus(
                allowed=False,
                current_usage=global_usage,
                limit=global_limit,
                window_seconds=window_seconds,
                remaining=0,
                reset_time=local_result["reset_time"],
                error_message="Global limit exceeded"
            )
        
        # Update global usage
        await self._update_global_usage(identifier, window_seconds)
        
        return RateLimitStatus(
            allowed=True,
            current_usage=global_usage + 1,
            limit=global_limit,
            window_seconds=window_seconds,
            remaining=global_limit - global_usage - 1,
            reset_time=local_result["reset_time"]
        )
    
    async def _get_global_usage(self, identifier: str, window_seconds: int) -> int:
        """Get global usage across all nodes."""
        rate_cache = await get_rate_limit_cache()
        
        # Use a sliding window approach
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)
        
        # Get usage from all nodes in the time window
        pattern = f"{self.coordination_key_prefix}:*:{identifier}"
        keys = await rate_cache.cache.redis.keys(pattern)
        
        total_usage = 0
        for key in keys:
            usage_data = await rate_cache.cache.get(key, [])
            if isinstance(usage_data, list):
                # Filter timestamps within window
                valid_timestamps = [
                    ts for ts in usage_data 
                    if datetime.fromisoformat(ts) > window_start
                ]
                total_usage += len(valid_timestamps)
        
        return total_usage
    
    async def _update_global_usage(self, identifier: str, window_seconds: int):
        """Update global usage tracking."""
        rate_cache = await get_rate_limit_cache()
        
        key = f"{self.coordination_key_prefix}:{self.node_id}:{identifier}"
        now = datetime.utcnow()
        
        # Get current usage list
        usage_list = await rate_cache.cache.get(key, [])
        if not isinstance(usage_list, list):
            usage_list = []
        
        # Add current timestamp
        usage_list.append(now.isoformat())
        
        # Clean old timestamps
        window_start = now - timedelta(seconds=window_seconds)
        usage_list = [
            ts for ts in usage_list 
            if datetime.fromisoformat(ts) > window_start
        ]
        
        # Store updated list
        await rate_cache.cache.set(key, usage_list, window_seconds * 2)


class CircuitBreakerRateLimit:
    """
    Circuit breaker pattern for rate limiting with automatic recovery.
    """
    
    def __init__(
        self,
        failure_threshold: int = 10,
        recovery_timeout: int = 60,
        half_open_max_calls: int = 5
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
    
    async def check_circuit_breaker(
        self,
        identifier: str,
        normal_check_func,
        *args, **kwargs
    ) -> RateLimitStatus:
        """Check rate limit with circuit breaker pattern."""
        
        rate_cache = await get_rate_limit_cache()
        circuit_key = f"circuit_breaker:{identifier}"
        
        # Get circuit state
        circuit_state = await rate_cache.cache.get(circuit_key, {
            "state": "closed",  # closed, open, half_open
            "failure_count": 0,
            "last_failure": None,
            "half_open_calls": 0
        })
        
        state = circuit_state["state"]
        now = datetime.utcnow()
        
        # Open circuit - deny all requests until recovery timeout
        if state == "open":
            last_failure = circuit_state.get("last_failure")
            if last_failure:
                last_failure_time = datetime.fromisoformat(last_failure)
                if (now - last_failure_time).seconds < self.recovery_timeout:
                    return RateLimitStatus(
                        allowed=False,
                        current_usage=0,
                        limit=0,
                        window_seconds=self.recovery_timeout,
                        remaining=0,
                        reset_time=(last_failure_time + timedelta(seconds=self.recovery_timeout)).isoformat(),
                        error_message="Circuit breaker open"
                    )
                else:
                    # Move to half-open state
                    circuit_state["state"] = "half_open"
                    circuit_state["half_open_calls"] = 0
                    await rate_cache.cache.set(circuit_key, circuit_state, 3600)
        
        # Half-open circuit - allow limited requests
        elif state == "half_open":
            if circuit_state["half_open_calls"] >= self.half_open_max_calls:
                return RateLimitStatus(
                    allowed=False,
                    current_usage=circuit_state["half_open_calls"],
                    limit=self.half_open_max_calls,
                    window_seconds=self.recovery_timeout,
                    remaining=0,
                    reset_time=now.isoformat(),
                    error_message="Circuit breaker half-open limit exceeded"
                )
        
        # Perform normal rate limit check
        try:
            result = await normal_check_func(*args, **kwargs)
            
            if result.allowed:
                # Success - reset failure count or close circuit
                if state == "half_open":
                    circuit_state["half_open_calls"] += 1
                    if circuit_state["half_open_calls"] >= self.half_open_max_calls:
                        # Close circuit
                        circuit_state["state"] = "closed"
                        circuit_state["failure_count"] = 0
                else:
                    circuit_state["failure_count"] = max(0, circuit_state["failure_count"] - 1)
            else:
                # Failure - increment failure count
                circuit_state["failure_count"] += 1
                circuit_state["last_failure"] = now.isoformat()
                
                # Open circuit if threshold exceeded
                if circuit_state["failure_count"] >= self.failure_threshold:
                    circuit_state["state"] = "open"
            
            # Update circuit state
            await rate_cache.cache.set(circuit_key, circuit_state, 3600)
            return result
            
        except Exception as e:
            # Exception during check - treat as failure
            circuit_state["failure_count"] += 1
            circuit_state["last_failure"] = now.isoformat()
            
            if circuit_state["failure_count"] >= self.failure_threshold:
                circuit_state["state"] = "open"
            
            await rate_cache.cache.set(circuit_key, circuit_state, 3600)
            
            return RateLimitStatus(
                allowed=False,
                current_usage=0,
                limit=0,
                window_seconds=0,
                remaining=0,
                reset_time=now.isoformat(),
                error_message=f"Rate limit check failed: {str(e)}"
            )


class GeographicRateLimit:
    """
    Geographic-based rate limiting with different limits per region.
    """
    
    def __init__(self):
        self.regional_multipliers = {
            "US": 1.0,
            "EU": 1.0,
            "AS": 0.8,
            "SA": 0.6,
            "AF": 0.4,
            "OC": 0.7,
            "unknown": 0.5
        }
    
    async def check_geographic_limit(
        self,
        identifier: str,
        base_limit: int,
        window_seconds: int,
        country_code: str = "unknown"
    ) -> RateLimitStatus:
        """Check rate limit with geographic adjustments."""
        
        # Get region from country code
        region = self._get_region_from_country(country_code)
        multiplier = self.regional_multipliers.get(region, 0.5)
        
        # Calculate regional limit
        regional_limit = max(1, int(base_limit * multiplier))
        
        # Check rate limit
        rate_cache = await get_rate_limit_cache()
        regional_identifier = f"geo:{region}:{identifier}"
        
        result = await rate_cache.check_rate_limit(
            regional_identifier,
            regional_limit,
            window_seconds,
            1
        )
        
        return RateLimitStatus(
            allowed=result["allowed"],
            current_usage=result["current_usage"],
            limit=regional_limit,
            window_seconds=window_seconds,
            remaining=max(0, regional_limit - result["current_usage"]),
            reset_time=result["reset_time"],
            retry_after=result.get("retry_after")
        )
    
    def _get_region_from_country(self, country_code: str) -> str:
        """Map country code to region."""
        region_mapping = {
            # North America
            "US": "US", "CA": "US", "MX": "US",
            # Europe
            "GB": "EU", "DE": "EU", "FR": "EU", "IT": "EU", "ES": "EU", "NL": "EU",
            "SE": "EU", "NO": "EU", "DK": "EU", "FI": "EU", "PL": "EU", "CH": "EU",
            # Asia
            "CN": "AS", "JP": "AS", "KR": "AS", "IN": "AS", "SG": "AS", "HK": "AS",
            "TW": "AS", "TH": "AS", "MY": "AS", "ID": "AS", "PH": "AS", "VN": "AS",
            # South America
            "BR": "SA", "AR": "SA", "CL": "SA", "CO": "SA", "PE": "SA", "VE": "SA",
            # Africa
            "ZA": "AF", "NG": "AF", "EG": "AF", "KE": "AF", "GH": "AF", "MA": "AF",
            # Oceania
            "AU": "OC", "NZ": "OC", "FJ": "OC", "PG": "OC"
        }
        
        return region_mapping.get(country_code.upper(), "unknown")


class RateLimitMonitor:
    """
    Monitor and analyze rate limit usage patterns.
    """
    
    async def get_rate_limit_analytics(
        self,
        identifier_pattern: str = "*",
        time_range_hours: int = 24
    ) -> Dict[str, Any]:
        """Get rate limit analytics for monitoring."""
        
        rate_cache = await get_rate_limit_cache()
        now = datetime.utcnow()
        start_time = now - timedelta(hours=time_range_hours)
        
        # Get all rate limit keys
        pattern = f"rate_limit:{identifier_pattern}"
        keys = await rate_cache.cache.redis.keys(pattern)
        
        analytics = {
            "total_identifiers": len(keys),
            "time_range_hours": time_range_hours,
            "top_consumers": [],
            "limit_breaches": [],
            "usage_patterns": {},
            "generated_at": now.isoformat()
        }
        
        # Analyze each identifier
        for key in keys[:100]:  # Limit to top 100 for performance
            try:
                # Extract identifier from key
                parts = key.split(":")
                if len(parts) >= 3:
                    identifier = ":".join(parts[2:])
                    
                    # Get usage data
                    usage_data = await rate_cache.cache.get(key, {})
                    if isinstance(usage_data, dict):
                        current_usage = usage_data.get("current_usage", 0)
                        limit = usage_data.get("limit", 0)
                        
                        if current_usage > 0:
                            analytics["top_consumers"].append({
                                "identifier": identifier,
                                "usage": current_usage,
                                "limit": limit,
                                "usage_percentage": (current_usage / limit * 100) if limit > 0 else 0
                            })
                            
                            # Check for limit breaches (>90% usage)
                            if limit > 0 and (current_usage / limit) > 0.9:
                                analytics["limit_breaches"].append({
                                    "identifier": identifier,
                                    "usage": current_usage,
                                    "limit": limit,
                                    "severity": "high" if current_usage >= limit else "warning"
                                })
            
            except Exception as e:
                logger.error(f"Error analyzing rate limit key {key}: {str(e)}")
                continue
        
        # Sort top consumers by usage
        analytics["top_consumers"].sort(key=lambda x: x["usage"], reverse=True)
        analytics["top_consumers"] = analytics["top_consumers"][:20]
        
        # Sort limit breaches by severity
        analytics["limit_breaches"].sort(key=lambda x: x["usage"], reverse=True)
        
        return analytics
    
    async def generate_rate_limit_report(
        self,
        workspace_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive rate limit report."""
        
        base_pattern = f"workspace:{workspace_id}:*" if workspace_id else "*"
        analytics = await self.get_rate_limit_analytics(base_pattern)
        
        # Add summary statistics
        total_usage = sum(consumer["usage"] for consumer in analytics["top_consumers"])
        avg_usage = total_usage / len(analytics["top_consumers"]) if analytics["top_consumers"] else 0
        
        breach_count = len(analytics["limit_breaches"])
        high_severity_breaches = len([b for b in analytics["limit_breaches"] if b["severity"] == "high"])
        
        report = {
            "summary": {
                "total_identifiers": analytics["total_identifiers"],
                "total_usage": total_usage,
                "average_usage": avg_usage,
                "limit_breaches": breach_count,
                "high_severity_breaches": high_severity_breaches,
                "breach_rate": (breach_count / analytics["total_identifiers"] * 100) if analytics["total_identifiers"] > 0 else 0
            },
            "recommendations": self._generate_recommendations(analytics),
            "analytics": analytics
        }
        
        return report
    
    def _generate_recommendations(self, analytics: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on analytics."""
        recommendations = []
        
        breach_count = len(analytics["limit_breaches"])
        total_identifiers = analytics["total_identifiers"]
        
        if total_identifiers > 0:
            breach_rate = breach_count / total_identifiers
            
            if breach_rate > 0.1:  # More than 10% breach rate
                recommendations.append(
                    "High rate limit breach rate detected. Consider increasing limits or implementing request queuing."
                )
            
            if breach_rate > 0.05:  # More than 5% breach rate
                recommendations.append(
                    "Consider implementing adaptive rate limiting based on user behavior and system load."
                )
        
        # Check for concentrated usage
        if analytics["top_consumers"]:
            top_usage = analytics["top_consumers"][0]["usage"]
            total_usage = sum(c["usage"] for c in analytics["top_consumers"])
            
            if total_usage > 0 and (top_usage / total_usage) > 0.5:
                recommendations.append(
                    "Single consumer accounts for >50% of usage. Consider dedicated limits or rate shaping."
                )
        
        # Check for high severity breaches
        high_severity = len([b for b in analytics["limit_breaches"] if b["severity"] == "high"])
        if high_severity > 0:
            recommendations.append(
                f"{high_severity} high-severity limit breaches detected. Review and potentially adjust limits."
            )
        
        if not recommendations:
            recommendations.append("Rate limiting is operating within normal parameters.")
        
        return recommendations


# Global instances for easy access
adaptive_limiter = AdaptiveRateLimiter()
distributed_limiter = DistributedRateLimiter()
circuit_breaker_limiter = CircuitBreakerRateLimit()
geographic_limiter = GeographicRateLimit()
rate_limit_monitor = RateLimitMonitor()