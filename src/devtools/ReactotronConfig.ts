import Reactotron from 'reactotron-react-native';

const IGNORE_URLS = /symbolicate|generate_204|logs\.|clients3\.google|reactotron/i;
const NOISY_WARNINGS = [/overflow to hidden on Surface/i];

type HeaderMap = Record<string, string> | null;

function normalizeHeaders(headers?: HeadersInit | Headers | null): HeaderMap {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function redactHeaders(headers: HeaderMap): HeaderMap {
  if (!headers) {
    return null;
  }

  const next = { ...headers };
  for (const key of Object.keys(next)) {
    if (key.toLowerCase() === 'authorization') {
      next[key] = 'Bearer ***';
    }
  }
  return next;
}

function parseBody(raw: unknown): unknown {
  if (raw == null || raw === '') {
    return null;
  }

  if (typeof raw !== 'string') {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

/**
 * Wraps global fetch so every API call (ky included) shows as native
 * API RESPONSE in Reactotron — works with Expo 56 expo/fetch.
 */
function installFetchLogger(reactotron: typeof Reactotron) {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveUrl(input);
    const method = resolveMethod(input, init);

    if (IGNORE_URLS.test(url)) {
      return originalFetch(input, init);
    }

    const started = Date.now();
    const requestHeaders = redactHeaders(
      normalizeHeaders(init?.headers ?? (input instanceof Request ? input.headers : null)),
    );
    const requestData = parseBody(init?.body ?? null);

    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - started;

      void (async () => {
        let body: unknown = null;
        try {
          body = parseBody(await response.clone().text());
        } catch {
          body = null;
        }

        // Types in reactotron-core are narrower than the desktop UI accepts (JSON body).
        reactotron.apiResponse(
          {
            url,
            method,
            data: requestData,
            headers: requestHeaders ?? {},
            params: null,
          },
          {
            body,
            status: response.status,
            headers: normalizeHeaders(response.headers) ?? {},
          } as { body: string; status: number; headers: Record<string, string> },
          duration,
        );
      })();

      return response;
    } catch (error) {
      reactotron.apiResponse(
        {
          url,
          method,
          data: requestData,
          headers: requestHeaders ?? {},
          params: null,
        },
        {
          body: error instanceof Error ? error.message : String(error),
          status: 0,
          headers: {},
        },
        Date.now() - started,
      );
      throw error;
    }
  };
}

function installWarnFilter() {
  // Must wrap AFTER Reactotron trackGlobalLogs, otherwise warnings still appear in timeline.
  const previousWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const message = String(args[0] ?? '');
    if (NOISY_WARNINGS.some((pattern) => pattern.test(message))) {
      return;
    }
    previousWarn(...args);
  };
}

const reactotron = Reactotron
  .configure({
    name: 'vot-hrenoviy-sovet',
  })
  .useReactNative({
    asyncStorage: false,
    networking: false, // replaced by global fetch logger (Expo 56 safe)
    errors: { veto: () => false },
    overlay: false,
  })
  .connect();

installFetchLogger(reactotron);
installWarnFilter();

export default reactotron;
