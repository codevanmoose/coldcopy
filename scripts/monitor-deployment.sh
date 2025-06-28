#!/bin/bash

# ColdCopy Deployment Monitoring Script
# Monitors deployment status and provides real-time feedback

echo "🔍 ColdCopy Deployment Monitor"
echo "=============================="

DOMAIN="https://coldcopy.cc"
CHECK_INTERVAL=30
MAX_CHECKS=120  # 1 hour of monitoring

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check_deployment() {
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN" 2>/dev/null)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $status in
        200)
            echo -e "${GREEN}✅ [$timestamp] SUCCESS: Deployment is live! (HTTP $status)${NC}"
            return 0
            ;;
        404)
            local error_info=$(curl -s -I "$DOMAIN" 2>/dev/null | grep -E "x-vercel-error|server")
            if echo "$error_info" | grep -q "DEPLOYMENT_NOT_FOUND"; then
                echo -e "${YELLOW}⏳ [$timestamp] Waiting: No deployment found yet${NC}"
            else
                echo -e "${RED}❌ [$timestamp] Error: 404 - Page not found${NC}"
            fi
            return 1
            ;;
        301|302)
            echo -e "${BLUE}🔄 [$timestamp] Redirect: Deployment in progress (HTTP $status)${NC}"
            return 1
            ;;
        500|502|503)
            echo -e "${RED}⚠️ [$timestamp] Server Error: Deployment issues (HTTP $status)${NC}"
            return 1
            ;;
        000)
            echo -e "${RED}💀 [$timestamp] Connection Failed: Domain not reachable${NC}"
            return 1
            ;;
        *)
            echo -e "${YELLOW}❓ [$timestamp] Unknown Status: HTTP $status${NC}"
            return 1
            ;;
    esac
}

test_basic_functionality() {
    echo -e "\n${BLUE}Testing basic functionality...${NC}"
    
    # Test main page
    local main_status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN")
    echo "Main page: HTTP $main_status"
    
    # Test API health
    local api_status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/health")
    echo "API health: HTTP $api_status"
    
    # Test login page
    local login_status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/login")
    echo "Login page: HTTP $login_status"
    
    if [[ $main_status == "200" && $api_status == "200" && $login_status == "200" ]]; then
        echo -e "${GREEN}✅ All basic functionality tests passed!${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ Some functionality tests failed, but deployment is partially working${NC}"
        return 1
    fi
}

show_deployment_info() {
    echo -e "\n${BLUE}=== DEPLOYMENT INFORMATION ===${NC}"
    echo "Domain: $DOMAIN"
    echo "Repository: https://github.com/codevanmoose/coldcopy"
    echo "Expected Features:"
    echo "  - User registration/login"
    echo "  - Workspace management"
    echo "  - Lead management"
    echo "  - Campaign creation"
    echo "  - Email automation"
    echo "  - CRM integrations"
    echo "  - Analytics dashboard"
    echo ""
}

main() {
    show_deployment_info
    
    echo -e "${YELLOW}Monitoring deployment status...${NC}"
    echo "Press Ctrl+C to stop monitoring"
    echo ""
    
    local check_count=0
    
    while [ $check_count -lt $MAX_CHECKS ]; do
        if check_deployment; then
            echo -e "\n${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
            
            # Run functionality tests
            if test_basic_functionality; then
                echo -e "\n${GREEN}🚀 ColdCopy is fully operational!${NC}"
                echo -e "Dashboard: $DOMAIN"
                echo -e "API: $DOMAIN/api"
                echo -e "Admin: $DOMAIN/admin"
            fi
            
            break
        fi
        
        ((check_count++))
        
        if [ $check_count -eq $MAX_CHECKS ]; then
            echo -e "\n${RED}⏰ Monitoring timeout reached ($(($MAX_CHECKS * $CHECK_INTERVAL / 60)) minutes)${NC}"
            echo -e "${YELLOW}Deployment may still be in progress. Check manually:${NC}"
            echo -e "  - Vercel dashboard: https://vercel.com/dashboard"
            echo -e "  - Supabase dashboard: https://supabase.com/dashboard"
            break
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Monitoring stopped by user.${NC}"; exit 0' INT

# Run the monitor
main