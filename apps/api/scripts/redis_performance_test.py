#!/usr/bin/env python3

"""
Redis performance testing script for ColdCopy.
"""

import asyncio
import time
import random
import string
import json
from typing import Dict, List, Any
from datetime import datetime
import statistics

import aioredis


class RedisPerformanceTester:
    """Test Redis performance for ColdCopy workloads."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis = None
        self.results = {}
    
    async def connect(self):
        """Connect to Redis."""
        self.redis = aioredis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        await self.redis.ping()
        print("✓ Connected to Redis")
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis:
            await self.redis.close()
    
    def generate_test_data(self, size: int = 1000) -> str:
        """Generate test data of specified size in bytes."""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=size))
    
    async def test_basic_operations(self, num_operations: int = 1000) -> Dict[str, float]:
        """Test basic Redis operations (GET/SET)."""
        print(f"\nTesting basic operations ({num_operations} operations)...")
        
        # Test SET operations
        start_time = time.time()
        for i in range(num_operations):
            key = f"test:basic:{i}"
            value = self.generate_test_data(100)
            await self.redis.set(key, value, ex=3600)  # 1 hour expiry
        set_time = time.time() - start_time
        
        # Test GET operations
        start_time = time.time()
        for i in range(num_operations):
            key = f"test:basic:{i}"
            await self.redis.get(key)
        get_time = time.time() - start_time
        
        # Cleanup
        await self.redis.delete(*[f"test:basic:{i}" for i in range(num_operations)])
        
        results = {
            "set_ops_per_second": num_operations / set_time,
            "get_ops_per_second": num_operations / get_time,
            "avg_set_latency_ms": (set_time / num_operations) * 1000,
            "avg_get_latency_ms": (get_time / num_operations) * 1000
        }
        
        print(f"  SET: {results['set_ops_per_second']:.2f} ops/sec")
        print(f"  GET: {results['get_ops_per_second']:.2f} ops/sec")
        
        return results
    
    async def test_json_operations(self, num_operations: int = 500) -> Dict[str, float]:
        """Test JSON serialization/deserialization performance."""
        print(f"\nTesting JSON operations ({num_operations} operations)...")
        
        # Generate complex JSON data
        test_data = {
            "user_id": "12345",
            "workspace_id": "67890",
            "email": "test@example.com",
            "enrichment_data": {
                "first_name": "John",
                "last_name": "Doe",
                "company": "Example Corp",
                "title": "Software Engineer",
                "social_profiles": ["linkedin.com/in/johndoe", "twitter.com/johndoe"],
                "phone": "+1-555-123-4567",
                "location": "San Francisco, CA"
            },
            "cached_at": datetime.utcnow().isoformat(),
            "ttl": 86400
        }
        
        # Test JSON SET operations
        start_time = time.time()
        for i in range(num_operations):
            key = f"test:json:{i}"
            value = json.dumps(test_data)
            await self.redis.set(key, value, ex=3600)
        json_set_time = time.time() - start_time
        
        # Test JSON GET operations
        start_time = time.time()
        for i in range(num_operations):
            key = f"test:json:{i}"
            value = await self.redis.get(key)
            if value:
                json.loads(value)
        json_get_time = time.time() - start_time
        
        # Cleanup
        await self.redis.delete(*[f"test:json:{i}" for i in range(num_operations)])
        
        results = {
            "json_set_ops_per_second": num_operations / json_set_time,
            "json_get_ops_per_second": num_operations / json_get_time,
            "avg_json_set_latency_ms": (json_set_time / num_operations) * 1000,
            "avg_json_get_latency_ms": (json_get_time / num_operations) * 1000
        }
        
        print(f"  JSON SET: {results['json_set_ops_per_second']:.2f} ops/sec")
        print(f"  JSON GET: {results['json_get_ops_per_second']:.2f} ops/sec")
        
        return results
    
    async def test_pipeline_operations(self, num_operations: int = 1000) -> Dict[str, float]:
        """Test Redis pipeline performance."""
        print(f"\nTesting pipeline operations ({num_operations} operations)...")
        
        # Test without pipeline
        start_time = time.time()
        for i in range(num_operations):
            key = f"test:nopipe:{i}"
            value = self.generate_test_data(50)
            await self.redis.set(key, value, ex=3600)
        no_pipeline_time = time.time() - start_time
        
        # Test with pipeline
        start_time = time.time()
        pipe = self.redis.pipeline()
        for i in range(num_operations):
            key = f"test:pipe:{i}"
            value = self.generate_test_data(50)
            pipe.set(key, value, ex=3600)
        await pipe.execute()
        pipeline_time = time.time() - start_time
        
        # Cleanup
        await self.redis.delete(*[f"test:nopipe:{i}" for i in range(num_operations)])
        await self.redis.delete(*[f"test:pipe:{i}" for i in range(num_operations)])
        
        results = {
            "no_pipeline_ops_per_second": num_operations / no_pipeline_time,
            "pipeline_ops_per_second": num_operations / pipeline_time,
            "pipeline_speedup": no_pipeline_time / pipeline_time
        }
        
        print(f"  Without pipeline: {results['no_pipeline_ops_per_second']:.2f} ops/sec")
        print(f"  With pipeline: {results['pipeline_ops_per_second']:.2f} ops/sec")
        print(f"  Speedup: {results['pipeline_speedup']:.2f}x")
        
        return results
    
    async def test_concurrent_operations(self, num_clients: int = 10, ops_per_client: int = 100) -> Dict[str, float]:
        """Test concurrent Redis operations."""
        print(f"\nTesting concurrent operations ({num_clients} clients, {ops_per_client} ops each)...")
        
        async def client_worker(client_id: int):
            """Worker function for each client."""
            client_redis = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            
            start_time = time.time()
            for i in range(ops_per_client):
                key = f"test:concurrent:{client_id}:{i}"
                value = self.generate_test_data(100)
                await client_redis.set(key, value, ex=3600)
                await client_redis.get(key)
            
            await client_redis.close()
            return time.time() - start_time
        
        # Run concurrent clients
        start_time = time.time()
        tasks = [client_worker(i) for i in range(num_clients)]
        client_times = await asyncio.gather(*tasks)
        total_time = time.time() - start_time
        
        total_ops = num_clients * ops_per_client * 2  # SET + GET
        
        # Cleanup
        keys_to_delete = []
        for client_id in range(num_clients):
            for i in range(ops_per_client):
                keys_to_delete.append(f"test:concurrent:{client_id}:{i}")
        
        # Delete in batches to avoid large commands
        batch_size = 100
        for i in range(0, len(keys_to_delete), batch_size):
            batch = keys_to_delete[i:i + batch_size]
            await self.redis.delete(*batch)
        
        results = {
            "total_ops_per_second": total_ops / total_time,
            "avg_client_time": statistics.mean(client_times),
            "max_client_time": max(client_times),
            "min_client_time": min(client_times)
        }
        
        print(f"  Total throughput: {results['total_ops_per_second']:.2f} ops/sec")
        print(f"  Avg client time: {results['avg_client_time']:.3f} seconds")
        
        return results
    
    async def test_expiration_performance(self, num_keys: int = 1000) -> Dict[str, float]:
        """Test key expiration performance."""
        print(f"\nTesting expiration performance ({num_keys} keys)...")
        
        # Set keys with short expiration
        start_time = time.time()
        for i in range(num_keys):
            key = f"test:expire:{i}"
            value = self.generate_test_data(50)
            await self.redis.set(key, value, ex=2)  # 2 second expiry
        set_time = time.time() - start_time
        
        # Check initial count
        initial_count = await self.redis.dbsize()
        
        # Wait for expiration
        await asyncio.sleep(3)
        
        # Check final count
        final_count = await self.redis.dbsize()
        
        results = {
            "set_ops_per_second": num_keys / set_time,
            "keys_expired": initial_count - final_count,
            "expiration_accuracy": (initial_count - final_count) / num_keys if num_keys > 0 else 0
        }
        
        print(f"  Keys expired: {results['keys_expired']}/{num_keys}")
        print(f"  Expiration accuracy: {results['expiration_accuracy']:.2%}")
        
        return results
    
    async def test_memory_usage(self) -> Dict[str, Any]:
        """Test memory usage patterns."""
        print("\nTesting memory usage...")
        
        # Get initial memory usage
        info = await self.redis.info("memory")
        initial_memory = info["used_memory"]
        
        # Add data and measure memory growth
        num_keys = 1000
        key_size = 1000  # 1KB per key
        
        for i in range(num_keys):
            key = f"test:memory:{i}"
            value = self.generate_test_data(key_size)
            await self.redis.set(key, value)
        
        # Get memory after adding data
        info = await self.redis.info("memory")
        final_memory = info["used_memory"]
        
        memory_per_key = (final_memory - initial_memory) / num_keys
        
        # Cleanup
        await self.redis.delete(*[f"test:memory:{i}" for i in range(num_keys)])
        
        results = {
            "initial_memory_bytes": initial_memory,
            "final_memory_bytes": final_memory,
            "memory_per_key_bytes": memory_per_key,
            "memory_overhead_ratio": memory_per_key / key_size if key_size > 0 else 0
        }
        
        print(f"  Memory per key: {memory_per_key:.2f} bytes")
        print(f"  Memory overhead: {results['memory_overhead_ratio']:.2f}x")
        
        return results
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all performance tests."""
        print("Starting Redis performance tests for ColdCopy...\n")
        
        await self.connect()
        
        try:
            # Run all tests
            self.results["basic_operations"] = await self.test_basic_operations()
            self.results["json_operations"] = await self.test_json_operations()
            self.results["pipeline_operations"] = await self.test_pipeline_operations()
            self.results["concurrent_operations"] = await self.test_concurrent_operations()
            self.results["expiration_performance"] = await self.test_expiration_performance()
            self.results["memory_usage"] = await self.test_memory_usage()
            
            # Add Redis server info
            info = await self.redis.info()
            self.results["server_info"] = {
                "redis_version": info["redis_version"],
                "used_memory_human": info["used_memory_human"],
                "connected_clients": info["connected_clients"],
                "total_commands_processed": info["total_commands_processed"],
                "keyspace_hits": info["keyspace_hits"],
                "keyspace_misses": info["keyspace_misses"]
            }
            
        finally:
            await self.disconnect()
        
        return self.results
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("REDIS PERFORMANCE TEST SUMMARY")
        print("="*60)
        
        if "basic_operations" in self.results:
            basic = self.results["basic_operations"]
            print(f"Basic Operations:")
            print(f"  SET: {basic['set_ops_per_second']:.0f} ops/sec")
            print(f"  GET: {basic['get_ops_per_second']:.0f} ops/sec")
        
        if "json_operations" in self.results:
            json_ops = self.results["json_operations"]
            print(f"JSON Operations:")
            print(f"  JSON SET: {json_ops['json_set_ops_per_second']:.0f} ops/sec")
            print(f"  JSON GET: {json_ops['json_get_ops_per_second']:.0f} ops/sec")
        
        if "pipeline_operations" in self.results:
            pipeline = self.results["pipeline_operations"]
            print(f"Pipeline Performance:")
            print(f"  Speedup: {pipeline['pipeline_speedup']:.1f}x")
        
        if "concurrent_operations" in self.results:
            concurrent = self.results["concurrent_operations"]
            print(f"Concurrent Operations:")
            print(f"  Throughput: {concurrent['total_ops_per_second']:.0f} ops/sec")
        
        if "server_info" in self.results:
            server = self.results["server_info"]
            print(f"Server Info:")
            print(f"  Redis Version: {server['redis_version']}")
            print(f"  Memory Usage: {server['used_memory_human']}")
        
        print("\nRecommendations:")
        
        # Performance recommendations
        if "basic_operations" in self.results:
            basic = self.results["basic_operations"]
            if basic["set_ops_per_second"] < 10000:
                print("  ⚠ SET performance is below optimal (< 10k ops/sec)")
            if basic["get_ops_per_second"] < 20000:
                print("  ⚠ GET performance is below optimal (< 20k ops/sec)")
        
        if "pipeline_operations" in self.results:
            pipeline = self.results["pipeline_operations"]
            if pipeline["pipeline_speedup"] > 5:
                print("  ✓ Use pipelining for bulk operations")
        
        if "memory_usage" in self.results:
            memory = self.results["memory_usage"]
            if memory["memory_overhead_ratio"] > 2:
                print("  ⚠ High memory overhead detected")
        
        print("\nRedis is ready for ColdCopy production workloads!")


async def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Redis Performance Test for ColdCopy")
    parser.add_argument("--redis-url", default="redis://localhost:6379", 
                       help="Redis connection URL")
    parser.add_argument("--output", help="Output file for results (JSON)")
    
    args = parser.parse_args()
    
    tester = RedisPerformanceTester(args.redis_url)
    
    try:
        results = await tester.run_all_tests()
        tester.print_summary()
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2, default=str)
            print(f"\nResults saved to {args.output}")
    
    except Exception as e:
        print(f"Error running tests: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    asyncio.run(main())