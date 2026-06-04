/**
 * Hash router — #/state and #/state/county
 * Drives view switching without any server config.
 */

const Router = (() => {
  const routes = [];
  let currentPath = null;

  function parse(hash) {
    // Strip leading #/ or #
    const raw = hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    return {
      state:  parts[0] || null,
      county: parts[1] || null,
    };
  }

  function navigate(path) {
    window.location.hash = path ? '/' + path : '/';
  }

  function on(pattern, handler) {
    // pattern: '' | ':state' | ':state/:county'
    routes.push({ pattern, handler });
  }

  function dispatch() {
    const { state, county } = parse(window.location.hash);
    const path = [state, county].filter(Boolean).join('/');

    if (path === currentPath) return;
    currentPath = path;

    for (const route of routes) {
      if (route.pattern === '' && !state) {
        route.handler({});
        return;
      }
      if (route.pattern === ':state' && state && !county) {
        route.handler({ state });
        return;
      }
      if (route.pattern === ':state/:county' && state && county) {
        route.handler({ state, county });
        return;
      }
    }

    // Fallback — home
    navigate('');
  }

  function start() {
    window.addEventListener('hashchange', dispatch);
    dispatch();
  }

  return { on, navigate, start, parse };
})();
