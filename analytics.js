(function () {
  function updateLastModified() {
    var footerDate = document.getElementById('last-updated');
    if (!footerDate) return;

    var modified = new Date(document.lastModified);
    if (Number.isNaN(modified.getTime())) return;

    footerDate.textContent = 'Updated on ' + new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(modified) + '.';
  }

  function updateVisitCounters(total, today) {
    var totalNode = document.getElementById('total-visits');
    var todayNode = document.getElementById('today-visits');
    var todayWrap = document.getElementById('today-visit-wrap');
    var todaySeparator = document.querySelector('.visit-separator');
    if (totalNode && typeof total === 'number') totalNode.textContent = total.toLocaleString();
    if (todayNode && typeof today === 'number') {
      todayNode.textContent = today.toLocaleString();
      if (todayWrap) todayWrap.hidden = false;
      if (todaySeparator) todaySeparator.hidden = false;
    } else {
      if (todayWrap) todayWrap.hidden = true;
      if (todaySeparator) todaySeparator.hidden = true;
    }
  }

  function normalizeEndpoint(endpoint) {
    return endpoint ? String(endpoint).trim().replace(/\/+$/, '') : '';
  }

  function fetchWithTimeout(url, options) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = null;
    var requestOptions = Object.assign({}, options || {});

    if (controller) {
      requestOptions.signal = controller.signal;
      timeoutId = setTimeout(function () {
        controller.abort();
      }, 5000);
    }

    return fetch(url, requestOptions).finally(function () {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  async function fetchPublicStats(endpoint) {
    try {
      var response = await fetchWithTimeout(endpoint + '/api/public-stats', {
        method: 'GET',
        cache: 'no-store'
      });
      if (!response.ok) return false;

      var data = await response.json();
      if (data && data.ok) {
        updateVisitCounters(data.totalVisits, data.todayVisits);
        return true;
      }
    } catch (error) {
      console.warn('Analytics stats unavailable:', error);
    }
    return false;
  }

  function togglePrivacyNote() {
    var config = window.HOMEPAGE_ANALYTICS || {};
    var note = document.getElementById('footer-note');
    if (!note) return;
    note.hidden = !config.showPrivacyNote;
  }

  async function reportVisit() {
    var config = window.HOMEPAGE_ANALYTICS || {};
    var endpoint = normalizeEndpoint(config.endpoint);
    if (!endpoint) {
      updateVisitCounters(undefined, undefined);
      return;
    }

    var updatedFromVisit = false;
    try {
      var response = await fetchWithTimeout(endpoint + '/api/visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: window.location.pathname,
          title: document.title
        }),
        keepalive: true
      });

      if (!response.ok) return;
      var data = await response.json();
      if (data && data.ok) {
        updateVisitCounters(data.totalVisits, data.todayVisits);
        updatedFromVisit = true;
      }
    } catch (error) {
      console.warn('Analytics unavailable:', error);
    }

    if (!updatedFromVisit) await fetchPublicStats(endpoint);
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateLastModified();
    togglePrivacyNote();
    reportVisit();
  });
})();
