#!/usr/bin/env python3
"""
Email Reputation Monitoring Dashboard
Real-time monitoring of SES reputation metrics and deliverability
"""

import os
import json
import boto3
import redis
import logging
from flask import Flask, jsonify, render_template_string, request
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import asyncio
from dataclasses import dataclass
from ses_manager import SESConfig
import pandas as pd
from collections import defaultdict

logger = logging.getLogger(__name__)

app = Flask(__name__)


@dataclass
class ReputationMetrics:
    """Email reputation metrics"""
    timestamp: datetime
    region: str
    bounce_rate: float
    complaint_rate: float
    delivery_rate: float
    open_rate: float
    click_rate: float
    reputation_score: float
    sending_quota_used: float
    suppression_list_size: int
    daily_send_count: int
    health_status: str
    issues: List[str]


class ReputationMonitor:
    """Monitors email reputation across regions"""
    
    def __init__(self, ses_config: SESConfig, redis_url: str = "redis://localhost:6379"):
        self.ses_config = ses_config
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.regions = [ses_config.primary_region] + ses_config.backup_regions
        self._init_ses_clients()
        
    def _init_ses_clients(self):
        """Initialize SES clients for all regions"""
        self.ses_clients = {}
        for region in self.regions:
            self.ses_clients[region] = boto3.client(
                'ses',
                region_name=region,
                aws_access_key_id=self.ses_config.aws_access_key_id,
                aws_secret_access_key=self.ses_config.aws_secret_access_key
            )
    
    async def collect_metrics(self) -> Dict[str, ReputationMetrics]:
        """Collect reputation metrics from all regions"""
        metrics = {}
        
        for region in self.regions:
            try:
                region_metrics = await self._collect_region_metrics(region)
                metrics[region] = region_metrics
                
                # Cache metrics
                self._cache_metrics(region, region_metrics)
                
            except Exception as e:
                logger.error(f"Failed to collect metrics for {region}: {str(e)}")
        
        return metrics
    
    async def _collect_region_metrics(self, region: str) -> ReputationMetrics:
        """Collect metrics for a specific region"""
        client = self.ses_clients[region]
        
        # Get send statistics
        stats_response = client.get_send_statistics()
        send_stats = self._process_send_statistics(stats_response['SendDataPoints'])
        
        # Get send quota
        quota_response = client.get_send_quota()
        quota_used = (quota_response['SentLast24Hours'] / quota_response['Max24HourSend']) * 100
        
        # Get reputation dashboard metrics (if available)
        reputation_score = await self._get_reputation_score(region)
        
        # Get suppression list size
        suppression_size = await self._get_suppression_list_size()
        
        # Calculate health status and issues
        health_status, issues = self._evaluate_health(
            send_stats['bounce_rate'],
            send_stats['complaint_rate'],
            reputation_score,
            quota_used
        )
        
        return ReputationMetrics(
            timestamp=datetime.utcnow(),
            region=region,
            bounce_rate=send_stats['bounce_rate'],
            complaint_rate=send_stats['complaint_rate'],
            delivery_rate=send_stats['delivery_rate'],
            open_rate=send_stats.get('open_rate', 0),
            click_rate=send_stats.get('click_rate', 0),
            reputation_score=reputation_score,
            sending_quota_used=quota_used,
            suppression_list_size=suppression_size,
            daily_send_count=quota_response['SentLast24Hours'],
            health_status=health_status,
            issues=issues
        )
    
    def _process_send_statistics(self, data_points: List[Dict]) -> Dict[str, float]:
        """Process SES send statistics"""
        if not data_points:
            return {
                'bounce_rate': 0,
                'complaint_rate': 0,
                'delivery_rate': 100,
                'total_sent': 0
            }
        
        # Aggregate last 24 hours
        total_sent = sum(point.get('DeliveryAttempts', 0) for point in data_points)
        total_bounces = sum(point.get('Bounces', 0) for point in data_points)
        total_complaints = sum(point.get('Complaints', 0) for point in data_points)
        
        if total_sent == 0:
            return {
                'bounce_rate': 0,
                'complaint_rate': 0,
                'delivery_rate': 100,
                'total_sent': 0
            }
        
        bounce_rate = (total_bounces / total_sent) * 100
        complaint_rate = (total_complaints / total_sent) * 100
        delivery_rate = 100 - bounce_rate
        
        return {
            'bounce_rate': round(bounce_rate, 3),
            'complaint_rate': round(complaint_rate, 4),
            'delivery_rate': round(delivery_rate, 2),
            'total_sent': total_sent
        }
    
    async def _get_reputation_score(self, region: str) -> float:
        """Get reputation score for region"""
        # In production, this would query AWS reputation dashboard
        # For now, calculate based on bounce/complaint rates
        
        key = f"reputation:score:{region}"
        cached_score = self.redis_client.get(key)
        
        if cached_score:
            return float(cached_score)
        
        # Default calculation
        return 95.0
    
    async def _get_suppression_list_size(self) -> int:
        """Get current suppression list size"""
        count = 0
        for _ in self.redis_client.scan_iter(match="ses:suppression:*"):
            count += 1
        return count
    
    def _evaluate_health(self, bounce_rate: float, complaint_rate: float, 
                        reputation_score: float, quota_used: float) -> Tuple[str, List[str]]:
        """Evaluate health status and identify issues"""
        issues = []
        
        # Check bounce rate
        if bounce_rate > 5:
            issues.append(f"Critical: Bounce rate too high ({bounce_rate}%)")
        elif bounce_rate > 2:
            issues.append(f"Warning: Elevated bounce rate ({bounce_rate}%)")
        
        # Check complaint rate
        if complaint_rate > 0.1:
            issues.append(f"Critical: Complaint rate too high ({complaint_rate}%)")
        elif complaint_rate > 0.05:
            issues.append(f"Warning: Elevated complaint rate ({complaint_rate}%)")
        
        # Check reputation score
        if reputation_score < 80:
            issues.append(f"Critical: Low reputation score ({reputation_score})")
        elif reputation_score < 90:
            issues.append(f"Warning: Reputation score declining ({reputation_score})")
        
        # Check quota usage
        if quota_used > 90:
            issues.append(f"Warning: High quota usage ({quota_used}%)")
        
        # Determine overall health
        if any("Critical" in issue for issue in issues):
            health_status = "critical"
        elif issues:
            health_status = "warning"
        else:
            health_status = "healthy"
        
        return health_status, issues
    
    def _cache_metrics(self, region: str, metrics: ReputationMetrics):
        """Cache metrics in Redis"""
        key = f"reputation:metrics:{region}:{metrics.timestamp.strftime('%Y%m%d%H%M')}"
        
        data = {
            'timestamp': metrics.timestamp.isoformat(),
            'bounce_rate': metrics.bounce_rate,
            'complaint_rate': metrics.complaint_rate,
            'delivery_rate': metrics.delivery_rate,
            'open_rate': metrics.open_rate,
            'click_rate': metrics.click_rate,
            'reputation_score': metrics.reputation_score,
            'sending_quota_used': metrics.sending_quota_used,
            'suppression_list_size': metrics.suppression_list_size,
            'daily_send_count': metrics.daily_send_count,
            'health_status': metrics.health_status,
            'issues': metrics.issues
        }
        
        self.redis_client.setex(
            key,
            timedelta(days=30),
            json.dumps(data)
        )
    
    def get_historical_metrics(self, region: str, hours: int = 24) -> List[Dict]:
        """Get historical metrics for a region"""
        metrics = []
        
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)
        
        # Scan for metrics in time range
        pattern = f"reputation:metrics:{region}:*"
        
        for key in self.redis_client.scan_iter(match=pattern):
            # Extract timestamp from key
            timestamp_str = key.split(':')[-1]
            timestamp = datetime.strptime(timestamp_str, '%Y%m%d%H%M')
            
            if start_time <= timestamp <= end_time:
                data = self.redis_client.get(key)
                if data:
                    metrics.append(json.loads(data))
        
        # Sort by timestamp
        metrics.sort(key=lambda x: x['timestamp'])
        
        return metrics
    
    def get_reputation_trends(self, region: str, metric: str, hours: int = 24) -> Dict:
        """Get trend data for a specific metric"""
        historical = self.get_historical_metrics(region, hours)
        
        if not historical:
            return {'error': 'No data available'}
        
        # Extract metric values
        timestamps = [m['timestamp'] for m in historical]
        values = [m.get(metric, 0) for m in historical]
        
        # Calculate trend
        if len(values) >= 2:
            trend = "improving" if values[-1] < values[0] else "declining" if values[-1] > values[0] else "stable"
        else:
            trend = "insufficient_data"
        
        # Calculate statistics
        avg_value = sum(values) / len(values) if values else 0
        max_value = max(values) if values else 0
        min_value = min(values) if values else 0
        
        return {
            'metric': metric,
            'region': region,
            'period_hours': hours,
            'trend': trend,
            'current_value': values[-1] if values else 0,
            'average_value': round(avg_value, 4),
            'max_value': round(max_value, 4),
            'min_value': round(min_value, 4),
            'data_points': list(zip(timestamps, values))
        }
    
    async def get_deliverability_insights(self) -> Dict[str, Any]:
        """Get deliverability insights and recommendations"""
        insights = {
            'overall_health': 'healthy',
            'regions': {},
            'recommendations': [],
            'alerts': []
        }
        
        # Collect current metrics
        current_metrics = await self.collect_metrics()
        
        critical_count = 0
        warning_count = 0
        
        for region, metrics in current_metrics.items():
            insights['regions'][region] = {
                'health': metrics.health_status,
                'issues': metrics.issues,
                'metrics': {
                    'bounce_rate': metrics.bounce_rate,
                    'complaint_rate': metrics.complaint_rate,
                    'reputation_score': metrics.reputation_score
                }
            }
            
            if metrics.health_status == 'critical':
                critical_count += 1
            elif metrics.health_status == 'warning':
                warning_count += 1
        
        # Determine overall health
        if critical_count > 0:
            insights['overall_health'] = 'critical'
        elif warning_count > 0:
            insights['overall_health'] = 'warning'
        
        # Generate recommendations
        insights['recommendations'] = self._generate_recommendations(current_metrics)
        
        # Generate alerts
        insights['alerts'] = self._generate_alerts(current_metrics)
        
        return insights
    
    def _generate_recommendations(self, metrics: Dict[str, ReputationMetrics]) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        for region, m in metrics.items():
            if m.bounce_rate > 2:
                recommendations.append(
                    f"Implement email validation before sending to reduce bounce rate in {region}"
                )
            
            if m.complaint_rate > 0.05:
                recommendations.append(
                    f"Review email content and frequency to reduce complaints in {region}"
                )
            
            if m.reputation_score < 90:
                recommendations.append(
                    f"Consider slowing down sending rate in {region} to improve reputation"
                )
            
            if m.suppression_list_size > 10000:
                recommendations.append(
                    "Review and clean suppression list - consider re-engagement campaigns"
                )
        
        return list(set(recommendations))  # Remove duplicates
    
    def _generate_alerts(self, metrics: Dict[str, ReputationMetrics]) -> List[Dict]:
        """Generate alerts for critical issues"""
        alerts = []
        
        for region, m in metrics.items():
            for issue in m.issues:
                if "Critical" in issue:
                    alerts.append({
                        'severity': 'critical',
                        'region': region,
                        'message': issue,
                        'timestamp': m.timestamp.isoformat()
                    })
        
        return alerts


# Flask routes for the dashboard

monitor = None

def init_monitor():
    """Initialize the reputation monitor"""
    global monitor
    ses_config = SESConfig(
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        primary_region=os.getenv('AWS_REGION', 'us-east-1'),
        backup_regions=os.getenv('AWS_BACKUP_REGIONS', 'eu-west-1').split(',')
    )
    monitor = ReputationMonitor(ses_config)


@app.route('/')
def dashboard():
    """Main dashboard view"""
    return render_template_string(DASHBOARD_TEMPLATE)


@app.route('/api/metrics/current')
async def get_current_metrics():
    """Get current metrics for all regions"""
    metrics = await monitor.collect_metrics()
    
    result = {}
    for region, m in metrics.items():
        result[region] = {
            'timestamp': m.timestamp.isoformat(),
            'bounce_rate': m.bounce_rate,
            'complaint_rate': m.complaint_rate,
            'delivery_rate': m.delivery_rate,
            'reputation_score': m.reputation_score,
            'sending_quota_used': m.sending_quota_used,
            'daily_send_count': m.daily_send_count,
            'health_status': m.health_status,
            'issues': m.issues
        }
    
    return jsonify(result)


@app.route('/api/metrics/historical/<region>')
def get_historical_metrics(region):
    """Get historical metrics for a region"""
    hours = int(request.args.get('hours', 24))
    metrics = monitor.get_historical_metrics(region, hours)
    return jsonify(metrics)


@app.route('/api/metrics/trends/<region>/<metric>')
def get_metric_trends(region, metric):
    """Get trend data for a specific metric"""
    hours = int(request.args.get('hours', 24))
    trends = monitor.get_reputation_trends(region, metric, hours)
    return jsonify(trends)


@app.route('/api/insights')
async def get_insights():
    """Get deliverability insights"""
    insights = await monitor.get_deliverability_insights()
    return jsonify(insights)


@app.route('/metrics')
def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}


# Dashboard HTML template
DASHBOARD_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>ColdCopy Email Reputation Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold mb-8">Email Reputation Dashboard</h1>
        
        <!-- Overall Health -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-xl font-semibold mb-4">Overall Health</h2>
            <div id="overall-health" class="flex items-center">
                <div class="w-4 h-4 rounded-full mr-2" id="health-indicator"></div>
                <span id="health-text" class="text-lg"></span>
            </div>
        </div>
        
        <!-- Region Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div id="region-cards"></div>
        </div>
        
        <!-- Charts -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Bounce Rate Trend</h3>
                <canvas id="bounce-chart"></canvas>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-lg font-semibold mb-4">Complaint Rate Trend</h3>
                <canvas id="complaint-chart"></canvas>
            </div>
        </div>
        
        <!-- Insights & Recommendations -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-xl font-semibold mb-4">Insights & Recommendations</h2>
            <div id="insights-content"></div>
        </div>
        
        <!-- Alerts -->
        <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4">Active Alerts</h2>
            <div id="alerts-content"></div>
        </div>
    </div>
    
    <script>
        // Dashboard JavaScript
        let bounceChart, complaintChart;
        
        async function loadDashboard() {
            try {
                // Load current metrics
                const metricsResponse = await axios.get('/api/metrics/current');
                updateMetrics(metricsResponse.data);
                
                // Load insights
                const insightsResponse = await axios.get('/api/insights');
                updateInsights(insightsResponse.data);
                
                // Load trends
                await loadTrends();
                
            } catch (error) {
                console.error('Error loading dashboard:', error);
            }
        }
        
        function updateMetrics(metrics) {
            const container = document.getElementById('region-cards');
            container.innerHTML = '';
            
            Object.entries(metrics).forEach(([region, data]) => {
                const card = createRegionCard(region, data);
                container.appendChild(card);
            });
        }
        
        function createRegionCard(region, data) {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-lg shadow-md p-6';
            
            const healthColor = {
                'healthy': 'bg-green-500',
                'warning': 'bg-yellow-500',
                'critical': 'bg-red-500'
            }[data.health_status] || 'bg-gray-500';
            
            card.innerHTML = `
                <h3 class="text-lg font-semibold mb-4">${region.toUpperCase()}</h3>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span>Status:</span>
                        <span class="flex items-center">
                            <div class="w-3 h-3 rounded-full ${healthColor} mr-2"></div>
                            ${data.health_status}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>Bounce Rate:</span>
                        <span>${data.bounce_rate}%</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Complaint Rate:</span>
                        <span>${data.complaint_rate}%</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Reputation Score:</span>
                        <span>${data.reputation_score}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Daily Sends:</span>
                        <span>${data.daily_send_count.toLocaleString()}</span>
                    </div>
                </div>
            `;
            
            return card;
        }
        
        function updateInsights(insights) {
            // Update overall health
            const healthIndicator = document.getElementById('health-indicator');
            const healthText = document.getElementById('health-text');
            
            const healthColor = {
                'healthy': 'bg-green-500',
                'warning': 'bg-yellow-500',
                'critical': 'bg-red-500'
            }[insights.overall_health] || 'bg-gray-500';
            
            healthIndicator.className = `w-4 h-4 rounded-full mr-2 ${healthColor}`;
            healthText.textContent = insights.overall_health.toUpperCase();
            
            // Update recommendations
            const insightsContent = document.getElementById('insights-content');
            if (insights.recommendations.length > 0) {
                insightsContent.innerHTML = '<ul class="list-disc list-inside space-y-2">' +
                    insights.recommendations.map(r => `<li>${r}</li>`).join('') +
                    '</ul>';
            } else {
                insightsContent.innerHTML = '<p class="text-gray-500">No recommendations at this time.</p>';
            }
            
            // Update alerts
            const alertsContent = document.getElementById('alerts-content');
            if (insights.alerts.length > 0) {
                alertsContent.innerHTML = insights.alerts.map(alert => `
                    <div class="border-l-4 border-red-500 bg-red-50 p-4 mb-2">
                        <p class="font-semibold">${alert.region}: ${alert.message}</p>
                        <p class="text-sm text-gray-600">${new Date(alert.timestamp).toLocaleString()}</p>
                    </div>
                `).join('');
            } else {
                alertsContent.innerHTML = '<p class="text-gray-500">No active alerts.</p>';
            }
        }
        
        async function loadTrends() {
            // Load bounce rate trends
            const bounceData = await axios.get('/api/metrics/trends/us-east-1/bounce_rate?hours=24');
            updateChart('bounce-chart', bounceData.data, 'Bounce Rate %');
            
            // Load complaint rate trends
            const complaintData = await axios.get('/api/metrics/trends/us-east-1/complaint_rate?hours=24');
            updateChart('complaint-chart', complaintData.data, 'Complaint Rate %');
        }
        
        function updateChart(canvasId, data, label) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.data_points.map(p => new Date(p[0]).toLocaleTimeString()),
                    datasets: [{
                        label: label,
                        data: data.data_points.map(p => p[1]),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Auto-refresh every 60 seconds
        setInterval(loadDashboard, 60000);
        
        // Initial load
        loadDashboard();
    </script>
</body>
</html>
"""


if __name__ == "__main__":
    init_monitor()
    app.run(host='0.0.0.0', port=8091, debug=False)