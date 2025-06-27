// Website Tracking Script Generator
// This generates a tracking script that clients can embed on their websites

export function generateTrackingScript(workspaceId: string, domain: string): string {
  return `
<!-- ColdCopy Sales Intelligence Tracking -->
<script>
(function() {
  // Configuration
  var WORKSPACE_ID = '${workspaceId}';
  var API_ENDPOINT = '${process.env.NEXT_PUBLIC_APP_URL}/api/track/visitor';
  var SESSION_KEY = 'cc_session_' + WORKSPACE_ID;
  var VISITOR_KEY = 'cc_visitor_' + WORKSPACE_ID;
  
  // Generate or retrieve visitor ID
  function getVisitorId() {
    var visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
    return visitorId;
  }
  
  // Generate or retrieve session ID
  function getSessionId() {
    var sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  }
  
  // Get UTM parameters
  function getUTMParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_term: params.get('utm_term'),
      utm_content: params.get('utm_content')
    };
  }
  
  // Track page view
  function trackPageView() {
    var startTime = Date.now();
    var maxScrollDepth = 0;
    var clicks = [];
    
    // Track scroll depth
    window.addEventListener('scroll', function() {
      var scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      var scrollDepth = Math.round((window.scrollY / scrollHeight) * 100);
      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth;
      }
    });
    
    // Track clicks
    document.addEventListener('click', function(e) {
      var target = e.target;
      var clickData = {
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        text: target.textContent ? target.textContent.substring(0, 50) : '',
        href: target.href || null,
        timestamp: Date.now()
      };
      clicks.push(clickData);
    });
    
    // Send tracking data on page unload
    function sendTrackingData() {
      var timeOnPage = Math.round((Date.now() - startTime) / 1000);
      var utm = getUTMParams();
      
      var data = {
        workspace_id: WORKSPACE_ID,
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        page_url: window.location.href,
        page_title: document.title,
        referrer_url: document.referrer,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        time_on_page: timeOnPage,
        scroll_depth: maxScrollDepth,
        clicks: clicks,
        user_agent: navigator.userAgent,
        screen_resolution: window.screen.width + 'x' + window.screen.height,
        viewport_size: window.innerWidth + 'x' + window.innerHeight,
        is_new_visitor: !localStorage.getItem(VISITOR_KEY + '_returning')
      };
      
      // Mark as returning visitor
      localStorage.setItem(VISITOR_KEY + '_returning', 'true');
      
      // Send data using sendBeacon for reliability
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API_ENDPOINT, JSON.stringify(data));
      } else {
        // Fallback to fetch
        fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true
        });
      }
    }
    
    // Send data on page unload
    window.addEventListener('beforeunload', sendTrackingData);
    window.addEventListener('pagehide', sendTrackingData);
    
    // Also send data after 30 seconds if still on page
    setTimeout(sendTrackingData, 30000);
  }
  
  // Initialize tracking
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }
  
  // Expose API for manual tracking
  window.ColdCopy = window.ColdCopy || {};
  window.ColdCopy.track = function(eventName, eventData) {
    fetch(API_ENDPOINT + '/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: WORKSPACE_ID,
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        event_name: eventName,
        event_data: eventData,
        page_url: window.location.href,
        timestamp: Date.now()
      })
    });
  };
  
  // Track form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form.tagName === 'FORM') {
      window.ColdCopy.track('form_submission', {
        form_id: form.id,
        form_action: form.action,
        form_method: form.method
      });
    }
  });
})();
</script>
<!-- End ColdCopy Tracking -->
`;
}

// Generate a simpler pixel tracking option
export function generateTrackingPixel(workspaceId: string): string {
  return `<img src="${process.env.NEXT_PUBLIC_APP_URL}/api/track/pixel?workspace_id=${workspaceId}" width="1" height="1" style="display:none;" alt="" />`;
}