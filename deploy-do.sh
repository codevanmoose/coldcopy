#!/bin/bash

echo "Creating ColdCopy API app on Digital Ocean..."

# You'll need to get your DO API token from: https://cloud.digitalocean.com/account/api/tokens
# Set it as an environment variable: export DO_API_TOKEN="your_token_here"

if [ -z "$DO_API_TOKEN" ]; then
    echo "Please set your Digital Ocean API token:"
    echo "export DO_API_TOKEN=\"your_token_here\""
    echo "Get it from: https://cloud.digitalocean.com/account/api/tokens"
    exit 1
fi

curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DO_API_TOKEN" \
  -d '{
    "spec": {
      "name": "coldcopy-api",
      "region": "nyc",
      "services": [
        {
          "name": "api",
          "environment_slug": "python",
          "github": {
            "repo": "codevanmoose/coldcopy",
            "branch": "main",
            "deploy_on_push": true
          },
          "source_dir": "/apps/api",
          "build_command": "pip install -r requirements-do.txt",
          "run_command": "uvicorn main_simple:app --host 0.0.0.0 --port 8000",
          "http_port": 8000,
          "instance_count": 1,
          "instance_size_slug": "basic-xxs"
        }
      ]
    }
  }' \
  "https://api.digitalocean.com/v2/apps"

echo "App created! Check your Digital Ocean dashboard."