let brometalStub;
let resolveVirtualModules = false;

export function initialize(data) {
  brometalStub = data.brometalStub;
  resolveVirtualModules = data.resolveVirtualModules;
}

export function resolve(specifier, context, nextResolve) {
  if (resolveVirtualModules && specifier.startsWith('virtual:')) {
    return {
      url: `data:text/javascript,export default ${JSON.stringify(specifier)}`,
      shortCircuit: true,
    };
  }

  // The stub re-exports the real package, so it must not be redirected into itself.
  if (specifier === 'brometal' && context.parentURL !== brometalStub) {
    return { url: brometalStub, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
