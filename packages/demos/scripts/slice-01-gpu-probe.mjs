import spriteShader from '../src/demos/brometal-town/shaders/town-sprite.shader.gen.ts';
import voxelShader from '../src/demos/brometal-town/shaders/town-voxel.shader.gen.ts';
import waterShader from '../src/demos/brometal-town/shaders/town-water.shader.gen.ts';

const FRAME_DRAW_PATTERN = Object.freeze([6, 9, 1]);

export const affectedUniformBlocks = Object.freeze([
  Object.freeze({ program: 'world', bytes: voxelShader.layout.uniformBlockSize }),
  Object.freeze({ program: 'actor-edges', bytes: voxelShader.layout.uniformBlockSize }),
  Object.freeze({ program: 'actors', bytes: spriteShader.layout.uniformBlockSize }),
  Object.freeze({ program: 'water', bytes: waterShader.layout.uniformBlockSize }),
]);

function addRecord(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function sumRecordValues(record) {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

function expectedAffectedWrites() {
  const writes = {};
  for (const block of affectedUniformBlocks) {
    writes[block.bytes] = (writes[block.bytes] ?? 0) + 1;
  }
  return writes;
}

function completeFrames(submissions) {
  const frames = [];
  for (let index = 0; index <= submissions.length - FRAME_DRAW_PATTERN.length;) {
    const candidate = submissions.slice(index, index + FRAME_DRAW_PATTERN.length);
    const matches = candidate.every((submission, offset) => (
      submission.drawCalls === FRAME_DRAW_PATTERN[offset]
      && (offset === 0 || submission.index === candidate[offset - 1].index + 1)
    ));
    if (matches) {
      frames.push(candidate);
      index += FRAME_DRAW_PATTERN.length;
    } else {
      index += 1;
    }
  }
  return frames;
}

function stableValue(values, label) {
  const first = values[0];
  if (!values.every((value) => value === first)) {
    throw new Error(`${label} changed across the steady frame window: ${values.join(', ')}.`);
  }
  return first;
}

function summarizeNumbers(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const median = ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
  return Object.freeze({
    minimum: ordered[0],
    median,
    maximum: ordered.at(-1),
  });
}

export function summarizeGpuProbe(probe, maximumFrames = 20) {
  if (probe?.version !== 1 || !Array.isArray(probe.submissions)) {
    throw new Error('The GPU probe payload is invalid.');
  }
  if (probe.installError) throw new Error(`The GPU probe did not install: ${probe.installError}`);

  const frames = completeFrames(probe.submissions).slice(-maximumFrames);
  if (frames.length === 0) throw new Error('The GPU probe found no complete [6, 9, 1] town frame.');

  const expected = expectedAffectedWrites();
  const frameFacts = frames.map((submissions) => {
    const writesByKind = {};
    const writesBySizeAndKind = {};
    const resourcesCreated = {};
    const readbackOperations = {};
    let draws = 0;
    let commandBuffers = 0;
    for (const submission of submissions) {
      draws += submission.drawCalls;
      commandBuffers += submission.commandBuffers;
      addRecord(writesByKind, submission.writeBufferBytesByKind);
      addRecord(resourcesCreated, submission.resourcesCreated);
      addRecord(readbackOperations, submission.readbackOperations);
      for (const [kind, sizes] of Object.entries(submission.writeBufferCallsByKindAndSize ?? {})) {
        writesBySizeAndKind[kind] ??= {};
        addRecord(writesBySizeAndKind[kind], sizes);
      }
    }

    const sceneUniformWrites = submissions[1].writeBufferCallsByKindAndSize?.uniform ?? {};
    for (const [bytes, count] of Object.entries(expected)) {
      if (sceneUniformWrites[bytes] !== count) {
        throw new Error(
          `The scene submission wrote ${sceneUniformWrites[bytes] ?? 0} uniform blocks of ${bytes} bytes; expected ${count}.`,
        );
      }
    }

    return {
      draws,
      commandBuffers,
      writesByKind,
      writesBySizeAndKind,
      resourcesCreated,
      readbackOperations,
    };
  });

  const affectedBytes = affectedUniformBlocks.reduce((sum, block) => sum + block.bytes, 0);
  const allKinds = new Set(frameFacts.flatMap((frame) => Object.keys(frame.writesByKind)));
  const writeBufferBytesPerFrame = {};
  for (const kind of allKinds) {
    writeBufferBytesPerFrame[kind] = summarizeNumbers(
      frameFacts.map((frame) => frame.writesByKind[kind] ?? 0),
    );
  }
  writeBufferBytesPerFrame.total = summarizeNumbers(frameFacts.map((frame) => (
    sumRecordValues(frame.writesByKind)
  )));

  const uniformWriteSignatures = frameFacts.map((frame) => (
    JSON.stringify(frame.writesBySizeAndKind.uniform ?? {})
  ));
  stableValue(uniformWriteSignatures, 'uniform write-size histogram');

  const resourcesCreatedDuringWindow = {};
  for (const frame of frameFacts) addRecord(resourcesCreatedDuringWindow, frame.resourcesCreated);
  const resourceCreationsPerFrame = {};
  for (const kind of Object.keys(resourcesCreatedDuringWindow)) {
    resourceCreationsPerFrame[kind] = summarizeNumbers(
      frameFacts.map((frame) => frame.resourcesCreated[kind] ?? 0),
    );
  }

  const allReadbackKinds = new Set(frameFacts.flatMap((frame) => (
    Object.keys(frame.readbackOperations)
  )));
  const readbackOperationsPerFrame = {};
  for (const kind of allReadbackKinds) {
    readbackOperationsPerFrame[kind] = summarizeNumbers(
      frameFacts.map((frame) => frame.readbackOperations[kind] ?? 0),
    );
  }
  readbackOperationsPerFrame.total = summarizeNumbers(frameFacts.map((frame) => (
    sumRecordValues(frame.readbackOperations)
  )));

  return Object.freeze({
    observedFrames: frames.length,
    firstSubmission: frames[0][0].index,
    lastSubmission: frames.at(-1).at(-1).index,
    queueSubmissionsPerFrame: FRAME_DRAW_PATTERN.length,
    commandBuffersPerFrame: stableValue(
      frameFacts.map((frame) => frame.commandBuffers),
      'command-buffer count',
    ),
    drawCallsPerFrame: stableValue(frameFacts.map((frame) => frame.draws), 'draw count'),
    writeBufferBytesPerFrame,
    uniformWriteCallsBySize: frameFacts[0].writesBySizeAndKind.uniform ?? {},
    affectedUniformBlocks,
    affectedUniformBytesPerFrame: affectedBytes,
    affectedUniformWritesPerFrame: expected,
    readbackOperationsPerFrame,
    resourceCreationsPerFrame,
    resourcesCreatedDuringWindow,
  });
}

export const gpuProbeSource = String.raw`(() => {
  const state = {
    version: 1,
    installError: null,
    adapterRequests: 0,
    deviceRequests: 0,
    queueSubmissions: 0,
    writeBufferCalls: 0,
    writeBufferBytes: 0,
    writeTextureCalls: 0,
    readbackOperations: {},
    resources: {},
    resourceBytes: {},
    submissions: [],
    pending: null,
  };
  Object.defineProperty(globalThis, '__antikyGpuProbe', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: state,
  });

  const bufferMetadata = new WeakMap();
  const proxyCache = new WeakMap();
  const instrumented = new WeakSet();
  const resourceMethods = new Map([
    ['createBuffer', 'buffers'],
    ['createTexture', 'textures'],
    ['createSampler', 'samplers'],
    ['createBindGroup', 'bindGroups'],
    ['createBindGroupLayout', 'bindGroupLayouts'],
    ['createPipelineLayout', 'pipelineLayouts'],
    ['createRenderPipeline', 'renderPipelines'],
    ['createComputePipeline', 'computePipelines'],
    ['createShaderModule', 'shaderModules'],
    ['createQuerySet', 'querySets'],
  ]);

  const increment = (record, key, value = 1) => {
    record[key] = (record[key] || 0) + value;
  };
  const pending = () => {
    if (!state.pending) {
      state.pending = {
        index: state.queueSubmissions + 1,
        commandBuffers: 0,
        drawCalls: 0,
        drawIndexedCalls: 0,
        writeBufferCalls: 0,
        writeBufferBytes: 0,
        writeBufferBytesByKind: {},
        writeBufferCallsByKindAndSize: {},
        resourcesCreated: {},
        readbackOperations: {},
      };
    }
    return state.pending;
  };
  const classifyBuffer = (usage) => {
    if (usage & GPUBufferUsage.UNIFORM) return 'uniform';
    if (usage & GPUBufferUsage.VERTEX) return 'vertex';
    if (usage & GPUBufferUsage.INDEX) return 'index';
    if (usage & GPUBufferUsage.STORAGE) return 'storage';
    return 'other';
  };
  const writtenBytes = (data, dataOffset, size) => {
    if (size !== undefined) return Number(size);
    const bytes = data.byteLength;
    return bytes - Number(dataOffset || 0);
  };
  const recordReadback = (kind) => {
    increment(state.readbackOperations, kind);
    increment(pending().readbackOperations, kind);
  };
  const isMapReadBuffer = (buffer) => {
    const metadata = bufferMetadata.get(buffer);
    return Boolean(metadata && (metadata.usage & GPUBufferUsage.MAP_READ));
  };
  let bufferMapReadInstrumented = false;
  const recordResource = (kind, descriptor, resource) => {
    increment(state.resources, kind);
    increment(pending().resourcesCreated, kind);
    if (kind === 'buffers') {
      const size = Number(descriptor?.size || 0);
      const usage = Number(descriptor?.usage || 0);
      increment(state.resourceBytes, kind, size);
      bufferMetadata.set(resource, { size, usage, kind: classifyBuffer(usage) });
      if (!bufferMapReadInstrumented && typeof resource.mapAsync === 'function') {
        try {
          replaceMethod(resource, 'mapAsync', (original) => function (mode, ...args) {
            const readMode = typeof GPUMapMode === 'undefined' ? 1 : GPUMapMode.READ;
            if ((Number(mode) & readMode) !== 0) recordReadback('bufferMapRead');
            return Reflect.apply(original, this, [mode, ...args]);
          });
          bufferMapReadInstrumented = true;
        } catch (error) {
          state.installError ||= error instanceof Error ? error.message : String(error);
        }
      }
    }
  };
  const replaceMethod = (target, name, createReplacement) => {
    let owner = target;
    while (owner && !Object.prototype.hasOwnProperty.call(owner, name)) {
      owner = Object.getPrototypeOf(owner);
    }
    if (!owner || typeof target[name] !== 'function') {
      throw new Error('WebGPU method ' + name + ' is unavailable.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(owner, name);
    const original = target[name];
    Object.defineProperty(owner, name, {
      ...descriptor,
      value: createReplacement(original),
    });
  };

  const proxyPass = (pass) => {
    if (proxyCache.has(pass)) return proxyCache.get(pass);
    const proxy = new Proxy(pass, {
      get(target, property) {
        if (property === 'draw' || property === 'drawIndexed') {
          return (...args) => {
            pending().drawCalls += 1;
            if (property === 'drawIndexed') pending().drawIndexedCalls += 1;
            return target[property](...args);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    proxyCache.set(pass, proxy);
    return proxy;
  };

  const proxyEncoder = (encoder) => {
    if (proxyCache.has(encoder)) return proxyCache.get(encoder);
    const proxy = new Proxy(encoder, {
      get(target, property) {
        if (property === 'beginRenderPass') {
          return (...args) => proxyPass(target.beginRenderPass(...args));
        }
        if (property === 'copyBufferToBuffer') {
          return (...args) => {
            if (isMapReadBuffer(args[2])) recordReadback('copyBufferToMapRead');
            return Reflect.apply(target.copyBufferToBuffer, target, args);
          };
        }
        if (property === 'copyTextureToBuffer') {
          return (...args) => {
            if (isMapReadBuffer(args[1]?.buffer)) recordReadback('copyTextureToMapRead');
            return Reflect.apply(target.copyTextureToBuffer, target, args);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    proxyCache.set(encoder, proxy);
    return proxy;
  };

  const instrumentQueue = (queue) => {
    if (instrumented.has(queue)) return queue;
    instrumented.add(queue);
    if (typeof queue.writeBuffer === 'function') {
      replaceMethod(queue, 'writeBuffer', (original) => function (...args) {
        const metadata = bufferMetadata.get(args[0]) || { kind: 'unknown' };
        const bytes = writtenBytes(args[2], args[3], args[4]);
        const sample = pending();
        state.writeBufferCalls += 1;
        state.writeBufferBytes += bytes;
        sample.writeBufferCalls += 1;
        sample.writeBufferBytes += bytes;
        increment(sample.writeBufferBytesByKind, metadata.kind, bytes);
        sample.writeBufferCallsByKindAndSize[metadata.kind] ||= {};
        increment(sample.writeBufferCallsByKindAndSize[metadata.kind], String(bytes));
        return Reflect.apply(original, this, args);
      });
    }
    if (typeof queue.writeTexture === 'function') {
      replaceMethod(queue, 'writeTexture', (original) => function (...args) {
        state.writeTextureCalls += 1;
        return Reflect.apply(original, this, args);
      });
    }
    if (typeof queue.submit === 'function') {
      replaceMethod(queue, 'submit', (original) => function (...args) {
        const sample = pending();
        sample.commandBuffers = args[0]?.length ?? 0;
        const result = Reflect.apply(original, this, args);
        state.queueSubmissions += 1;
        state.submissions.push(sample);
        if (state.submissions.length > 240) state.submissions.shift();
        state.pending = null;
        return result;
      });
    }
    return queue;
  };

  const instrumentDevice = (device) => {
    if (instrumented.has(device)) return device;
    instrumented.add(device);
    instrumentQueue(device.queue);
    if (typeof device.createCommandEncoder === 'function') {
      replaceMethod(device, 'createCommandEncoder', (original) => function (...args) {
        return proxyEncoder(Reflect.apply(original, this, args));
      });
    }
    for (const [method, resourceKind] of resourceMethods) {
      if (typeof device[method] !== 'function') continue;
      replaceMethod(device, method, (original) => function (...args) {
        const resource = Reflect.apply(original, this, args);
        recordResource(resourceKind, args[0], resource);
        return resource;
      });
    }
    return device;
  };

  const instrumentAdapter = (adapter) => {
    if (!adapter || instrumented.has(adapter)) return adapter;
    instrumented.add(adapter);
    replaceMethod(adapter, 'requestDevice', (original) => async function (...args) {
      state.deviceRequests += 1;
      return instrumentDevice(await Reflect.apply(original, this, args));
    });
    return adapter;
  };

  try {
    const gpu = navigator.gpu;
    if (!gpu) throw new Error('WebGPU is unavailable.');
    let requestAdapterOwner = gpu;
    while (
      requestAdapterOwner
      && !Object.prototype.hasOwnProperty.call(requestAdapterOwner, 'requestAdapter')
    ) {
      requestAdapterOwner = Object.getPrototypeOf(requestAdapterOwner);
    }
    if (!requestAdapterOwner) throw new Error('WebGPU requestAdapter is unavailable.');
    const descriptor = Object.getOwnPropertyDescriptor(requestAdapterOwner, 'requestAdapter');
    const requestAdapter = gpu.requestAdapter;
    Object.defineProperty(requestAdapterOwner, 'requestAdapter', {
      ...descriptor,
      value: async function (...args) {
        state.adapterRequests += 1;
        return instrumentAdapter(await Reflect.apply(requestAdapter, this, args));
      },
    });
  } catch (error) {
    state.installError = error instanceof Error ? error.message : String(error);
  }
})()`;
