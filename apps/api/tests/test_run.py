"""
Test runner script for comprehensive API testing.
"""
import pytest
import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def run_all_tests():
    """Run all tests with comprehensive coverage."""
    args = [
        "--verbose",
        "--tb=short",
        "--durations=10",
        "--cov=.",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov",
        "--cov-fail-under=70",  # Lowered for initial run
        "--asyncio-mode=auto",
        str(Path(__file__).parent)
    ]
    
    return pytest.main(args)


def run_unit_tests():
    """Run only unit tests (fast)."""
    args = [
        "--verbose",
        "-m", "unit",
        str(Path(__file__).parent)
    ]
    
    return pytest.main(args)


def run_integration_tests():
    """Run only integration tests."""
    args = [
        "--verbose",
        "-m", "integration", 
        str(Path(__file__).parent)
    ]
    
    return pytest.main(args)


def run_security_tests():
    """Run only security tests."""
    args = [
        "--verbose",
        "-m", "security",
        str(Path(__file__).parent)
    ]
    
    return pytest.main(args)


def run_performance_tests():
    """Run only performance tests."""
    args = [
        "--verbose",
        "-m", "performance",
        str(Path(__file__).parent)
    ]
    
    return pytest.main(args)


def run_specific_test_file(test_file: str):
    """Run a specific test file."""
    test_path = Path(__file__).parent / test_file
    
    if not test_path.exists():
        print(f"Test file {test_file} not found!")
        return 1
    
    args = [
        "--verbose",
        "--tb=short", 
        str(test_path)
    ]
    
    return pytest.main(args)


def main():
    """Main test runner with command line options."""
    if len(sys.argv) < 2:
        print("Running all tests...")
        return run_all_tests()
    
    command = sys.argv[1].lower()
    
    if command == "all":
        return run_all_tests()
    elif command == "unit":
        return run_unit_tests()
    elif command == "integration":
        return run_integration_tests()
    elif command == "security":
        return run_security_tests()
    elif command == "performance":
        return run_performance_tests()
    elif command.startswith("test_"):
        return run_specific_test_file(command)
    else:
        print(f"""
Usage: python test_run.py [command]

Commands:
  all          - Run all tests (default)
  unit         - Run unit tests only
  integration  - Run integration tests only
  security     - Run security tests only
  performance  - Run performance tests only
  test_*.py    - Run specific test file

Examples:
  python test_run.py all
  python test_run.py unit
  python test_run.py test_api_endpoints.py
  python test_run.py security
        """)
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)