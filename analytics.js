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
    if (totalNode && typeof total === 'number') totalNode.textContent = total.toLocaleString();
    if (todayNode && typeof today === 'number') todayNode.textContent = today.toLocaleString();
  }

  function togglePrivacyNote() {
    var config = window.HOMEPAGE_ANALYTICS || {};
    var note = document.getElementById('footer-note');
    if (!note) return;
    note.hidden = !config.showPrivacyNote;
  }

  async function reportVisit() {
    var config = window.HOMEPAGE_ANALYTICS || {};
    if (!config.endpoint) return;

    var endpoint = String(config.endpoint).replace(/\/+$/, '');
    try {
      var response = await fetch(endpoint + '/api/visit', {
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
      }
    } catch (error) {
      console.warn('Analytics unavailable:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateLastModified();
    togglePrivacyNote();
    reportVisit();
  });
})();
