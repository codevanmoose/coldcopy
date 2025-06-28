#!/bin/bash

# ColdCopy Digital Ocean Spaces Deployment Script
# Sets up object storage and CDN for file management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="nyc3"
SPACES_PREFIX="coldcopy"
CDN_SUBDOMAIN="cdn"

echo -e "${BLUE}ColdCopy Storage & CDN Setup${NC}"
echo "============================"
echo ""

# Buckets to create
declare -A BUCKETS=(
  ["uploads"]="private"
  ["assets"]="public-read"
  ["exports"]="private"
  ["backups"]="private"
)

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    if ! command -v doctl &> /dev/null; then
        echo -e "${RED}✗ doctl CLI not found${NC}"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}✗ AWS CLI not found${NC}"
        echo "Install: pip install awscli"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites met${NC}"
}

# Function to create Spaces bucket
create_space() {
    local bucket_name=$1
    local acl=$2
    
    echo ""
    echo "Creating Space: ${bucket_name} (${acl})..."
    
    # Check if space exists
    if aws s3 ls --endpoint-url https://${REGION}.digitaloceanspaces.com s3://${bucket_name} 2>/dev/null; then
        echo -e "${YELLOW}Space ${bucket_name} already exists${NC}"
        return
    fi
    
    # Create space
    aws s3 mb s3://${bucket_name} \
        --endpoint-url https://${REGION}.digitaloceanspaces.com \
        --region ${REGION}
    
    # Set ACL
    if [ "$acl" = "public-read" ]; then
        aws s3api put-bucket-acl \
            --bucket ${bucket_name} \
            --acl public-read \
            --endpoint-url https://${REGION}.digitaloceanspaces.com
    fi
    
    echo -e "${GREEN}✓ Created ${bucket_name}${NC}"
}

# Function to configure CORS
configure_cors() {
    local bucket_name=$1
    
    echo "Configuring CORS for ${bucket_name}..."
    
    cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://coldcopy.cc", "https://*.coldcopy.cc"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

    aws s3api put-bucket-cors \
        --bucket ${bucket_name} \
        --cors-configuration file:///tmp/cors.json \
        --endpoint-url https://${REGION}.digitaloceanspaces.com
    
    rm /tmp/cors.json
}

# Function to configure lifecycle policies
configure_lifecycle() {
    local bucket_name=$1
    
    echo "Configuring lifecycle policies for ${bucket_name}..."
    
    case $bucket_name in
        *-uploads)
            cat > /tmp/lifecycle.json << 'EOF'
{
  "Rules": [
    {
      "ID": "DeleteTempFiles",
      "Status": "Enabled",
      "Prefix": "temp/",
      "Expiration": {
        "Days": 1
      }
    },
    {
      "ID": "DeleteOldImports",
      "Status": "Enabled",
      "Prefix": "workspaces/*/imports/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
EOF
            ;;
            
        *-exports)
            cat > /tmp/lifecycle.json << 'EOF'
{
  "Rules": [
    {
      "ID": "DeleteOldExports",
      "Status": "Enabled",
      "Prefix": "",
      "Expiration": {
        "Days": 7
      }
    }
  ]
}
EOF
            ;;
            
        *-backups)
            cat > /tmp/lifecycle.json << 'EOF'
{
  "Rules": [
    {
      "ID": "DeleteOldBackups",
      "Status": "Enabled",
      "Prefix": "",
      "Expiration": {
        "Days": 90
      }
    }
  ]
}
EOF
            ;;
            
        *)
            return
            ;;
    esac
    
    aws s3api put-bucket-lifecycle-configuration \
        --bucket ${bucket_name} \
        --lifecycle-configuration file:///tmp/lifecycle.json \
        --endpoint-url https://${REGION}.digitaloceanspaces.com || true
    
    rm -f /tmp/lifecycle.json
}

# Function to enable CDN
enable_cdn() {
    local bucket_name=$1
    
    echo "Enabling CDN for ${bucket_name}..."
    
    # Note: This needs to be done via DO API or dashboard
    # CDN is automatically enabled for Spaces
    
    echo -e "${YELLOW}CDN endpoint: ${bucket_name}.${REGION}.cdn.digitaloceanspaces.com${NC}"
}

# Function to create directory structure
create_directory_structure() {
    local bucket_name=$1
    
    echo "Creating directory structure for ${bucket_name}..."
    
    # Create placeholder files for directory structure
    case $bucket_name in
        *-uploads)
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/workspaces/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/users/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/temp/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            ;;
            
        *-assets)
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/email-templates/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/brand/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/public/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            ;;
            
        *-exports)
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/reports/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/bulk-exports/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            ;;
            
        *-backups)
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/database/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            echo "placeholder" | aws s3 cp - s3://${bucket_name}/configurations/.keep \
                --endpoint-url https://${REGION}.digitaloceanspaces.com
            ;;
    esac
}

# Function to generate access keys
generate_access_keys() {
    echo ""
    echo "Generating Spaces access keys..."
    
    # This must be done via DO API or dashboard
    echo -e "${YELLOW}Please generate Spaces access keys in the Digital Ocean dashboard:${NC}"
    echo "1. Go to API → Tokens/Keys → Spaces access keys"
    echo "2. Click 'Generate New Key'"
    echo "3. Name it 'coldcopy-spaces-key'"
    echo "4. Save the Access Key and Secret Key"
    echo ""
    echo "Add to your environment variables:"
    echo "DO_SPACES_KEY=<your-access-key>"
    echo "DO_SPACES_SECRET=<your-secret-key>"
    echo "DO_SPACES_ENDPOINT=https://${REGION}.digitaloceanspaces.com"
    echo "DO_SPACES_REGION=${REGION}"
}

# Function to configure AWS CLI for Spaces
configure_aws_cli() {
    echo ""
    echo "Configuring AWS CLI for Spaces..."
    
    # Create profile for DO Spaces
    aws configure set aws_access_key_id ${DO_SPACES_KEY} --profile digitalocean
    aws configure set aws_secret_access_key ${DO_SPACES_SECRET} --profile digitalocean
    aws configure set region ${REGION} --profile digitalocean
    
    echo -e "${GREEN}✓ AWS CLI configured for Spaces${NC}"
}

# Function to test upload
test_upload() {
    local bucket_name=$1
    
    echo ""
    echo "Testing upload to ${bucket_name}..."
    
    # Create test file
    echo "ColdCopy Storage Test" > /tmp/test-upload.txt
    
    # Upload
    aws s3 cp /tmp/test-upload.txt s3://${bucket_name}/test-upload.txt \
        --endpoint-url https://${REGION}.digitaloceanspaces.com \
        --profile digitalocean
    
    # Verify
    aws s3 ls s3://${bucket_name}/test-upload.txt \
        --endpoint-url https://${REGION}.digitaloceanspaces.com \
        --profile digitalocean
    
    # Cleanup
    aws s3 rm s3://${bucket_name}/test-upload.txt \
        --endpoint-url https://${REGION}.digitaloceanspaces.com \
        --profile digitalocean
    
    rm /tmp/test-upload.txt
    
    echo -e "${GREEN}✓ Upload test successful${NC}"
}

# Function to display summary
display_summary() {
    echo ""
    echo "Storage Configuration Summary"
    echo "============================"
    echo ""
    echo "Spaces Created:"
    for bucket in "${!BUCKETS[@]}"; do
        echo "  - ${SPACES_PREFIX}-${bucket} (${BUCKETS[$bucket]})"
        echo "    Endpoint: https://${SPACES_PREFIX}-${bucket}.${REGION}.digitaloceanspaces.com"
        echo "    CDN: https://${SPACES_PREFIX}-${bucket}.${REGION}.cdn.digitaloceanspaces.com"
    done
    echo ""
    echo "Next Steps:"
    echo "1. Generate Spaces access keys in DO dashboard"
    echo "2. Configure environment variables in your app"
    echo "3. Set up custom CDN domain (optional)"
    echo "4. Configure backup policies"
    echo "5. Monitor usage and costs"
}

# Main deployment flow
main() {
    check_prerequisites
    
    echo ""
    echo -e "${YELLOW}This will create Digital Ocean Spaces for ColdCopy${NC}"
    echo -e "${YELLOW}Estimated cost: $5/month + usage${NC}"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled"
        exit 0
    fi
    
    # Check if credentials are set
    if [ -z "$DO_SPACES_KEY" ] || [ -z "$DO_SPACES_SECRET" ]; then
        echo -e "${YELLOW}Spaces credentials not found${NC}"
        generate_access_keys
        echo ""
        echo "Please set the credentials and run this script again."
        exit 0
    fi
    
    configure_aws_cli
    
    # Create and configure each bucket
    for bucket in "${!BUCKETS[@]}"; do
        local full_bucket_name="${SPACES_PREFIX}-${bucket}"
        create_space "$full_bucket_name" "${BUCKETS[$bucket]}"
        configure_cors "$full_bucket_name"
        configure_lifecycle "$full_bucket_name"
        create_directory_structure "$full_bucket_name"
        enable_cdn "$full_bucket_name"
        
        # Test upload on first bucket
        if [ "$bucket" = "uploads" ]; then
            test_upload "$full_bucket_name"
        fi
    done
    
    display_summary
    
    echo ""
    echo -e "${GREEN}Storage setup complete!${NC}"
}

# Run main function
main