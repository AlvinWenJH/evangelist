#!/usr/bin/env python3
"""
Comprehensive API Test Script for Evangelist Project
Tests all endpoints and generates documentation updates based on actual responses.
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional
import time


class APITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = {}

    def log(self, message: str, level: str = "INFO"):
        """Log messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def test_endpoint(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        files: Optional[Dict] = None,
        description: str = "",
    ) -> Dict[str, Any]:
        """Test a single endpoint and return results"""
        url = f"{self.base_url}{endpoint}"

        try:
            self.log(f"Testing {method} {endpoint} - {description}")

            if method.upper() == "GET":
                response = self.session.get(url, params=params)
            elif method.upper() == "POST":
                if files:
                    response = self.session.post(
                        url, data=data, files=files, params=params
                    )
                else:
                    response = self.session.post(url, json=data, params=params)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, params=params)
            elif method.upper() == "PATCH":
                response = self.session.patch(url, json=data, params=params)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, params=params)
            else:
                raise ValueError(f"Unsupported method: {method}")

            result = {
                "method": method.upper(),
                "endpoint": endpoint,
                "description": description,
                "status_code": response.status_code,
                "success": response.status_code < 400,
                "response_headers": dict(response.headers),
                "request_data": data,
                "request_params": params,
                "request_files": files is not None,
            }

            try:
                result["response_json"] = response.json()
            except:
                result["response_text"] = response.text

            if result["success"]:
                self.log(
                    f"✅ SUCCESS: {method} {endpoint} - Status: {response.status_code}"
                )
            else:
                self.log(
                    f"❌ FAILED: {method} {endpoint} - Status: {response.status_code}",
                    "ERROR",
                )

            return result

        except Exception as e:
            self.log(f"❌ ERROR: {method} {endpoint} - {str(e)}", "ERROR")
            return {
                "method": method.upper(),
                "endpoint": endpoint,
                "description": description,
                "error": str(e),
                "success": False,
            }

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        self.log("=== Testing Authentication Endpoints ===")

        tests = [
            {
                "method": "POST",
                "endpoint": "/v1/auth/sign-in",
                "params": {"username": "admin", "password": "secretpassword"},
                "description": "Valid login",
            }
        ]

        results = []
        for test in tests:
            result = self.test_endpoint(**test)
            results.append(result)

        self.test_results["auth"] = results
        return results

    def test_dataset_endpoints(self):
        """Test dataset management endpoints"""
        self.log("=== Testing Dataset Management Endpoints ===")

        # Create a test dataset first
        # create_data = {
        #     "name": "test_dataset",
        #     "description": "Test dataset for API testing",
        #     "dataset_metadata": {},
        # }

        tests = [
            {
                "method": "GET",
                "endpoint": "/v1/datasets",
                "description": "Get all datasets",
            },
            # {
            #     "method": "POST",
            #     "endpoint": "/v1/datasets",
            #     "json": create_data,
            #     "description": "Create new dataset",
            # },
            {
                "method": "GET",
                "endpoint": "/v1/datasets/stats/overview",
                "description": "Get dataset statistics",
            },
            {
                "method": "GET",
                "endpoint": "/v1/datasets/search/advanced",
                "params": {"name": "test", "limit": 10},
                "description": "Advanced search",
            },
        ]

        results = []
        dataset_id = None

        for test in tests:
            result = self.test_endpoint(**test)
            results.append(result)

            # Extract dataset ID from create response
            if (
                test["method"] == "POST"
                and test["endpoint"] == "/v1/datasets"
                and result.get("success")
                and "response_json" in result
            ):
                dataset_id = result["response_json"].get("data", {}).get("id")

        # Test endpoints that require dataset_id
        if dataset_id:
            id_tests = [
                {
                    "method": "GET",
                    "endpoint": f"/v1/datasets/{dataset_id}",
                    "description": f"Get dataset by ID: {dataset_id}",
                },
                {
                    "method": "GET",
                    "endpoint": f"/v1/datasets/{dataset_id}/exists",
                    "description": f"Check dataset exists: {dataset_id}",
                },
                {
                    "method": "GET",
                    "endpoint": "/v1/datasets/77a1ae23-0ed2-4a32-a6f9-083908313106/schema",
                    "description": "Get dataset schema: 77a1ae23-0ed2-4a32-a6f9-083908313106 (has CSV data)",
                },
                {
                    "method": "PUT",
                    "endpoint": f"/v1/datasets/{dataset_id}",
                    "data": {
                        "name": "test_dataset_updated",
                        "description": "Updated test dataset",
                        "dataset_metadata": {"test": True, "version": "1.1"},
                    },
                    "description": f"Update dataset: {dataset_id}",
                },
            ]

            for test in id_tests:
                result = self.test_endpoint(**test)
                results.append(result)

        self.test_results["datasets"] = results
        return results

    def test_suite_endpoints(self):
        """Test evaluation suite management endpoints"""
        self.log("=== Testing Evaluation Suite Management Endpoints ===")

        # Create a test suite
        create_data = {
            "name": "test_suite",
            "description": "Test evaluation suite",
            "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
            "configuration": {
                "preprocessing": {"steps": []},
                "invocation": {"model": "gpt-4", "temperature": 0.7},
                "postprocessing": {"steps": []},
                "evaluation": {"metrics": ["accuracy"]},
            },
        }

        tests = [
            {
                "method": "GET",
                "endpoint": "/v1/suites",
                "description": "Get all suites",
            },
            # {
            #     "method": "POST",
            #     "endpoint": "/v1/suites",
            #     "data": create_data,
            #     "description": "Create new suite",
            # },
            {
                "method": "GET",
                "endpoint": "/v1/suites/stats/overview",
                "description": "Get suite statistics",
            },
        ]

        results = []
        suite_id = None

        for test in tests:
            result = self.test_endpoint(**test)
            results.append(result)

            # Extract suite ID from create response
            if (
                test["method"] == "POST"
                and test["endpoint"] == "/v1/suites"
                and result.get("success")
                and "response_json" in result
            ):
                suite_id = result["response_json"].get("data", {}).get("id")

        # Test endpoints that require suite_id
        if suite_id:
            id_tests = [
                {
                    "method": "GET",
                    "endpoint": f"/v1/suites/{suite_id}",
                    "description": f"Get suite by ID: {suite_id}",
                },
                {
                    "method": "GET",
                    "endpoint": f"/v1/suites/{suite_id}/config",
                    "description": f"Get suite configuration: {suite_id}",
                },
                {
                    "method": "PUT",
                    "endpoint": f"/v1/suites/{suite_id}/configuration",
                    "data": {
                        "configuration": {
                            "preprocessing": {"steps": ["normalize"]},
                            "invocation": {"model": "gpt-4", "temperature": 0.8},
                            "postprocessing": {"steps": []},
                            "evaluation": {"metrics": ["accuracy", "precision"]},
                        }
                    },
                    "description": f"Update suite configuration: {suite_id}",
                },
            ]

            for test in id_tests:
                result = self.test_endpoint(**test)
                results.append(result)

        self.test_results["suites"] = results
        return results

    def test_eval_endpoints(self):
        """Test evaluation management endpoints"""
        self.log("=== Testing Evaluation Management Endpoints ===")

        # Create a test evaluation
        create_data = {
            "name": "test_evaluation",
            "description": "Test evaluation",
            "suite_id": "a701c3cf-d3f6-4c79-9a06-5b15b378a8cd",
            "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
            "status": "pending",
        }

        tests = [
            {
                "method": "GET",
                "endpoint": "/v1/evals",
                "description": "Get all evaluations",
            },
            # {
            #     "method": "POST",
            #     "endpoint": "/v1/evals",
            #     "data": create_data,
            #     "description": "Create new evaluation",
            # },
            {
                "method": "GET",
                "endpoint": "/v1/evals/stats/overview",
                "description": "Get evaluation statistics",
            },
        ]

        results = []
        eval_id = None

        for test in tests:
            result = self.test_endpoint(**test)
            results.append(result)

            # Extract eval ID from create response
            if (
                test["method"] == "POST"
                and test["endpoint"] == "/v1/evals"
                and result.get("success")
                and "response_json" in result
            ):
                eval_id = result["response_json"].get("data", {}).get("id")

        # Test endpoints that require eval_id
        if eval_id:
            id_tests = [
                {
                    "method": "GET",
                    "endpoint": f"/v1/evals/{eval_id}",
                    "description": f"Get evaluation by ID: {eval_id}",
                },
                {
                    "method": "PUT",
                    "endpoint": f"/v1/evals/{eval_id}",
                    "data": {
                        "name": "test_evaluation_updated",
                        "description": "Updated test evaluation",
                        "status": "running",
                    },
                    "description": f"Update evaluation: {eval_id}",
                },
            ]

            for test in id_tests:
                result = self.test_endpoint(**test)
                results.append(result)

        self.test_results["evals"] = results
        return results

    def run_all_tests(self):
        """Run all API tests"""
        self.log("🚀 Starting comprehensive API testing...")

        # Test server connectivity
        try:
            response = requests.get(f"{self.base_url}/docs", timeout=5)
            if response.status_code == 200:
                self.log("✅ Server is running and accessible")
            else:
                self.log(f"⚠️ Server responded with status: {response.status_code}")
        except Exception as e:
            self.log(f"❌ Cannot connect to server: {e}", "ERROR")
            return False

        # Run all test suites
        self.test_auth_endpoints()
        self.test_dataset_endpoints()
        self.test_suite_endpoints()
        self.test_eval_endpoints()

        # Generate summary
        self.generate_summary()

        return True

    def generate_summary(self):
        """Generate test summary and save results"""
        self.log("=== Test Summary ===")

        total_tests = 0
        successful_tests = 0

        for category, tests in self.test_results.items():
            category_success = sum(1 for test in tests if test.get("success", False))
            category_total = len(tests)
            total_tests += category_total
            successful_tests += category_success

            self.log(
                f"{category.upper()}: {category_success}/{category_total} tests passed"
            )

        self.log(f"OVERALL: {successful_tests}/{total_tests} tests passed")

        # Save detailed results to file
        with open("api_test_results.json", "w") as f:
            json.dump(self.test_results, f, indent=2)

        self.log("📄 Detailed results saved to api_test_results.json")

        return self.test_results


def main():
    """Main function to run API tests"""
    import argparse

    parser = argparse.ArgumentParser(description="Test Evangelist API endpoints")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL for the API (default: http://localhost:8000)",
    )

    args = parser.parse_args()

    tester = APITester(args.base_url)
    success = tester.run_all_tests()

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
