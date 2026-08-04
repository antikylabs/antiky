const DEFAULT_OPTIONS = Object.freeze({
  slug: 'town-study',
  host: '127.0.0.1',
  port: 3010,
  width: 1280,
  height: 720,
});

function readInteger(value, name, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`The demo host ${name} must be an integer from 1 through ${maximum}.`);
  }
  return parsed;
}

function readInspectionOrigin(value) {
  if (!value) return '';
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('ANTIKY_INSPECTION_URL must be an absolute loopback HTTP origin.');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.origin !== value
    || url.username !== ''
    || url.password !== ''
  ) {
    throw new Error('ANTIKY_INSPECTION_URL must be an absolute loopback HTTP origin.');
  }
  return value;
}

export function parseDemoHostOptions(input) {
  const args = input.filter((argument) => argument !== '--');
  let index = 0;
  let slug = DEFAULT_OPTIONS.slug;
  if (args[0] && !args[0].startsWith('-')) {
    slug = args[0];
    index = 1;
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Invalid demo slug: ${slug}`);
  }

  const options = { ...DEFAULT_OPTIONS, slug };
  while (index < args.length) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
    if (flag === '--host') options.host = value;
    else if (flag === '--port') options.port = readInteger(value, 'port', 65_535);
    else if (flag === '--width') options.width = readInteger(value, 'width', 16_384);
    else if (flag === '--height') options.height = readInteger(value, 'height', 16_384);
    else throw new Error(`Unknown demo host option: ${flag}.`);
    index += 2;
  }
  if (options.host !== '127.0.0.1') {
    throw new Error('The demo host must bind to 127.0.0.1.');
  }
  return Object.freeze(options);
}

export function createDemoHostEnvironment(options, environment = process.env) {
  return {
    ...environment,
    VITE_ANTIKY_DEMO_SLUG: options.slug,
    VITE_ANTIKY_GAME_WIDTH: String(options.width),
    VITE_ANTIKY_GAME_HEIGHT: String(options.height),
    VITE_ANTIKY_INSPECTION_ORIGIN: readInspectionOrigin(environment.ANTIKY_INSPECTION_URL),
  };
}
