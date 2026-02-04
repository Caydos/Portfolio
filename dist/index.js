"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/game/geometry/cube.ts
  function createMesh(device) {
    const vertexData = new Float32Array([
      // X, Y, Z
      -0.5,
      -0.5,
      0.5,
      // front
      0.5,
      -0.5,
      0.5,
      0.5,
      0.5,
      0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      -0.5,
      // back
      0.5,
      -0.5,
      -0.5,
      0.5,
      0.5,
      -0.5,
      -0.5,
      0.5,
      -0.5
    ]);
    const indexData = new Uint16Array([
      // Front face (Z+)
      0,
      1,
      2,
      2,
      3,
      0,
      // Back face (Z-)
      5,
      4,
      7,
      7,
      6,
      5,
      // Left face (X-)
      4,
      0,
      3,
      3,
      7,
      4,
      // Right face (X+)
      1,
      5,
      6,
      6,
      2,
      1,
      // Top face (Y+)
      3,
      2,
      6,
      6,
      7,
      3,
      // Bottom face (Y-)
      4,
      5,
      1,
      1,
      0,
      4
    ]);
    const vertexBuffer = device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertexData);
    vertexBuffer.unmap();
    const indexBuffer = device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(indexData);
    indexBuffer.unmap();
    return {
      vertexBuffer,
      indexBuffer,
      indexCount: indexData.length
    };
  }

  // src/engine/render/data.ts
  var renderData = {
    canvas: null,
    adapter: null,
    device: null,
    context: null,
    format: null,
    meshManager: null,
    camera: null
  };

  // src/engine/render/pipelines/post/class.ts
  var PostPipeline = class {
    constructor(device, shaderCode) {
      this.device = device;
      const canvas = renderData.canvas;
      const w = canvas.width;
      const h = canvas.height;
      this.bloomW = Math.max(1, Math.floor(w / 2));
      this.bloomH = Math.max(1, Math.floor(h / 2));
      const module = device.createShaderModule({ code: shaderCode });
      this.sampler = device.createSampler({
        magFilter: "nearest",
        minFilter: "nearest"
      });
      this.paramsBuffer = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.extractPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vs_main" },
        fragment: {
          module,
          entryPoint: "fs_extract",
          targets: [{ format: "rgba16float" }]
        },
        primitive: { topology: "triangle-list", cullMode: "none" }
      });
      this.blurPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vs_main" },
        fragment: {
          module,
          entryPoint: "fs_blur",
          targets: [{ format: "rgba16float" }]
        },
        primitive: { topology: "triangle-list", cullMode: "none" }
      });
      this.compositePipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vs_main" },
        fragment: {
          module,
          entryPoint: "fs_composite",
          targets: [{ format: renderData.format }]
        },
        primitive: { topology: "triangle-list", cullMode: "none" }
      });
      this.extractBGL = this.extractPipeline.getBindGroupLayout(0);
      this.blurBGL = this.blurPipeline.getBindGroupLayout(0);
      this.compositeBGL0 = this.compositePipeline.getBindGroupLayout(0);
      this.compositeBGL1 = this.compositePipeline.getBindGroupLayout(1);
      this.bloomA = device.createTexture({
        size: { width: this.bloomW, height: this.bloomH },
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.bloomAView = this.bloomA.createView();
      this.bloomB = device.createTexture({
        size: { width: this.bloomW, height: this.bloomH },
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.bloomBView = this.bloomB.createView();
      this.bgl = this.compositePipeline.getBindGroupLayout(0);
    }
    makeBindGroup(sceneHDRView, bloomInView) {
      return this.device.createBindGroup({
        layout: this.bgl,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: sceneHDRView },
          { binding: 2, resource: bloomInView },
          { binding: 3, resource: { buffer: this.paramsBuffer } }
        ]
      });
    }
    encode(commandEncoder, sceneHDRView, swapView) {
      const texelSizeX = 1 / this.bloomW;
      const texelSizeY = 1 / this.bloomH;
      const makeBG = (layout, bloomInView) => this.device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: sceneHDRView },
          { binding: 2, resource: bloomInView },
          { binding: 3, resource: { buffer: this.paramsBuffer } }
        ]
      });
      const extractLayout = this.extractPipeline.getBindGroupLayout(0);
      const blurLayout = this.blurPipeline.getBindGroupLayout(0);
      const compositeLayout = this.compositePipeline.getBindGroupLayout(0);
      this.writeParams({
        texelSizeX,
        texelSizeY,
        dirX: 0,
        dirY: 0,
        threshold: 1,
        bloomStrength: 0.9,
        exposure: 1
      });
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: this.bloomAView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
          }]
        });
        pass.setPipeline(this.extractPipeline);
        pass.setBindGroup(0, makeBG(extractLayout, this.bloomBView));
        pass.draw(3, 1, 0, 0);
        pass.end();
      }
      this.writeParams({
        texelSizeX,
        texelSizeY,
        dirX: 1,
        dirY: 0,
        threshold: 1,
        bloomStrength: 0.9,
        exposure: 1
      });
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: this.bloomBView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
          }]
        });
        pass.setPipeline(this.blurPipeline);
        pass.setBindGroup(0, makeBG(blurLayout, this.bloomAView));
        pass.draw(3, 1, 0, 0);
        pass.end();
      }
      this.writeParams({
        texelSizeX,
        texelSizeY,
        dirX: 0,
        dirY: 1,
        threshold: 1,
        bloomStrength: 0.9,
        exposure: 1
      });
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: this.bloomAView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
          }]
        });
        pass.setPipeline(this.blurPipeline);
        pass.setBindGroup(0, makeBG(blurLayout, this.bloomBView));
        pass.draw(3, 1, 0, 0);
        pass.end();
      }
      this.writeParams({
        texelSizeX,
        texelSizeY,
        dirX: 0,
        dirY: 0,
        threshold: 1,
        bloomStrength: 0.9,
        exposure: 1.15
      });
      {
        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: swapView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
          }]
        });
        pass.setPipeline(this.compositePipeline);
        pass.setBindGroup(0, makeBG(compositeLayout, this.bloomAView));
        pass.draw(3, 1, 0, 0);
        pass.end();
      }
    }
    writeParams(p) {
      const arr = new Float32Array(8);
      arr[0] = p.texelSizeX;
      arr[1] = p.texelSizeY;
      arr[2] = p.dirX;
      arr[3] = p.dirY;
      arr[4] = p.threshold;
      arr[5] = p.bloomStrength;
      arr[6] = p.exposure;
      arr[7] = 0;
      this.device.queue.writeBuffer(this.paramsBuffer, 0, arr.buffer);
    }
  };

  // node_modules/bitecs/dist/index.mjs
  var TYPES_ENUM = {
    i8: "i8",
    ui8: "ui8",
    ui8c: "ui8c",
    i16: "i16",
    ui16: "ui16",
    i32: "i32",
    ui32: "ui32",
    f32: "f32",
    f64: "f64",
    eid: "eid"
  };
  var TYPES_NAMES = {
    i8: "Int8",
    ui8: "Uint8",
    ui8c: "Uint8Clamped",
    i16: "Int16",
    ui16: "Uint16",
    i32: "Int32",
    ui32: "Uint32",
    eid: "Uint32",
    f32: "Float32",
    f64: "Float64"
  };
  var TYPES = {
    i8: Int8Array,
    ui8: Uint8Array,
    ui8c: Uint8ClampedArray,
    i16: Int16Array,
    ui16: Uint16Array,
    i32: Int32Array,
    ui32: Uint32Array,
    f32: Float32Array,
    f64: Float64Array,
    eid: Uint32Array
  };
  var UNSIGNED_MAX = {
    uint8: 2 ** 8,
    uint16: 2 ** 16,
    uint32: 2 ** 32
  };
  var roundToMultiple = (mul3) => (x) => Math.ceil(x / mul3) * mul3;
  var roundToMultiple4 = roundToMultiple(4);
  var $storeRef = Symbol("storeRef");
  var $storeSize = Symbol("storeSize");
  var $storeMaps = Symbol("storeMaps");
  var $storeFlattened = Symbol("storeFlattened");
  var $storeBase = Symbol("storeBase");
  var $storeType = Symbol("storeType");
  var $storeArrayElementCounts = Symbol("storeArrayElementCounts");
  var $storeSubarrays = Symbol("storeSubarrays");
  var $subarrayCursors = Symbol("subarrayCursors");
  var $subarray = Symbol("subarray");
  var $subarrayFrom = Symbol("subarrayFrom");
  var $subarrayTo = Symbol("subarrayTo");
  var $parentArray = Symbol("parentArray");
  var $tagStore = Symbol("tagStore");
  var $queryShadow = Symbol("queryShadow");
  var $serializeShadow = Symbol("serializeShadow");
  var $indexType = Symbol("indexType");
  var $indexBytes = Symbol("indexBytes");
  var $isEidType = Symbol("isEidType");
  var stores = {};
  var createShadow = (store, key) => {
    if (!ArrayBuffer.isView(store)) {
      const shadowStore = store[$parentArray].slice(0);
      store[key] = store.map((_, eid) => {
        const { length: length2 } = store[eid];
        const start = length2 * eid;
        const end = start + length2;
        return shadowStore.subarray(start, end);
      });
    } else {
      store[key] = store.slice(0);
    }
  };
  var resetStoreFor = (store, eid) => {
    if (store[$storeFlattened]) {
      store[$storeFlattened].forEach((ta) => {
        if (ArrayBuffer.isView(ta))
          ta[eid] = 0;
        else
          ta[eid].fill(0);
      });
    }
  };
  var createTypeStore = (type, length2) => {
    const totalBytes = length2 * TYPES[type].BYTES_PER_ELEMENT;
    const buffer = new ArrayBuffer(totalBytes);
    const store = new TYPES[type](buffer);
    store[$isEidType] = type === TYPES_ENUM.eid;
    return store;
  };
  var createArrayStore = (metadata, type, length2) => {
    const storeSize = metadata[$storeSize];
    const store = Array(storeSize).fill(0);
    store[$storeType] = type;
    store[$isEidType] = type === TYPES_ENUM.eid;
    const cursors = metadata[$subarrayCursors];
    const indexType = length2 <= UNSIGNED_MAX.uint8 ? TYPES_ENUM.ui8 : length2 <= UNSIGNED_MAX.uint16 ? TYPES_ENUM.ui16 : TYPES_ENUM.ui32;
    if (!length2)
      throw new Error("bitECS - Must define component array length");
    if (!TYPES[type])
      throw new Error(`bitECS - Invalid component array property type ${type}`);
    if (!metadata[$storeSubarrays][type]) {
      const arrayElementCount = metadata[$storeArrayElementCounts][type];
      const array = new TYPES[type](roundToMultiple4(arrayElementCount * storeSize));
      array[$indexType] = TYPES_NAMES[indexType];
      array[$indexBytes] = TYPES[indexType].BYTES_PER_ELEMENT;
      metadata[$storeSubarrays][type] = array;
    }
    const start = cursors[type];
    const end = start + storeSize * length2;
    cursors[type] = end;
    store[$parentArray] = metadata[$storeSubarrays][type].subarray(start, end);
    for (let eid = 0; eid < storeSize; eid++) {
      const start2 = length2 * eid;
      const end2 = start2 + length2;
      store[eid] = store[$parentArray].subarray(start2, end2);
      store[eid][$indexType] = TYPES_NAMES[indexType];
      store[eid][$indexBytes] = TYPES[indexType].BYTES_PER_ELEMENT;
      store[eid][$subarray] = true;
    }
    return store;
  };
  var isArrayType = (x) => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number";
  var createStore = (schema, size) => {
    const $store = Symbol("store");
    if (!schema || !Object.keys(schema).length) {
      stores[$store] = {
        [$storeSize]: size,
        [$tagStore]: true,
        [$storeBase]: () => stores[$store]
      };
      return stores[$store];
    }
    schema = JSON.parse(JSON.stringify(schema));
    const arrayElementCounts = {};
    const collectArrayElementCounts = (s) => {
      const keys = Object.keys(s);
      for (const k of keys) {
        if (isArrayType(s[k])) {
          if (!arrayElementCounts[s[k][0]])
            arrayElementCounts[s[k][0]] = 0;
          arrayElementCounts[s[k][0]] += s[k][1];
        } else if (s[k] instanceof Object) {
          collectArrayElementCounts(s[k]);
        }
      }
    };
    collectArrayElementCounts(schema);
    const metadata = {
      [$storeSize]: size,
      [$storeMaps]: {},
      [$storeSubarrays]: {},
      [$storeRef]: $store,
      [$subarrayCursors]: Object.keys(TYPES).reduce((a, type) => ({ ...a, [type]: 0 }), {}),
      [$storeFlattened]: [],
      [$storeArrayElementCounts]: arrayElementCounts
    };
    if (schema instanceof Object && Object.keys(schema).length) {
      const recursiveTransform = (a, k) => {
        if (typeof a[k] === "string") {
          a[k] = createTypeStore(a[k], size);
          a[k][$storeBase] = () => stores[$store];
          metadata[$storeFlattened].push(a[k]);
        } else if (isArrayType(a[k])) {
          const [type, length2] = a[k];
          a[k] = createArrayStore(metadata, type, length2);
          a[k][$storeBase] = () => stores[$store];
          metadata[$storeFlattened].push(a[k]);
        } else if (a[k] instanceof Object) {
          a[k] = Object.keys(a[k]).reduce(recursiveTransform, a[k]);
        }
        return a;
      };
      stores[$store] = Object.assign(Object.keys(schema).reduce(recursiveTransform, schema), metadata);
      stores[$store][$storeBase] = () => stores[$store];
      return stores[$store];
    }
  };
  var SparseSet = () => {
    const dense = [];
    const sparse = [];
    dense.sort = function(comparator) {
      const result = Array.prototype.sort.call(this, comparator);
      for (let i = 0; i < dense.length; i++) {
        sparse[dense[i]] = i;
      }
      return result;
    };
    const has = (val) => dense[sparse[val]] === val;
    const add3 = (val) => {
      if (has(val))
        return;
      sparse[val] = dense.push(val) - 1;
    };
    const remove = (val) => {
      if (!has(val))
        return;
      const index = sparse[val];
      const swapped = dense.pop();
      if (swapped !== val) {
        dense[index] = swapped;
        sparse[swapped] = index;
      }
    };
    const reset = () => {
      dense.length = 0;
      sparse.length = 0;
    };
    return {
      add: add3,
      remove,
      has,
      sparse,
      dense,
      reset
    };
  };
  var not = (fn) => (v) => !fn(v);
  var storeFlattened = (c) => c[$storeFlattened];
  var isFullComponent = storeFlattened;
  var isProperty = not(isFullComponent);
  var isModifier = (c) => typeof c === "function" && c[$modifier];
  var isNotModifier = not(isModifier);
  var $entityMasks = Symbol("entityMasks");
  var $entityComponents = Symbol("entityComponents");
  var $entitySparseSet = Symbol("entitySparseSet");
  var $entityArray = Symbol("entityArray");
  var $entityIndices = Symbol("entityIndices");
  var $removedEntities = Symbol("removedEntities");
  var defaultSize = 1e5;
  var globalEntityCursor = 0;
  var globalSize = defaultSize;
  var getGlobalSize = () => globalSize;
  var removed = [];
  var recycled = [];
  var defaultRemovedReuseThreshold = 0.01;
  var removedReuseThreshold = defaultRemovedReuseThreshold;
  var getEntityCursor = () => globalEntityCursor;
  var eidToWorld = /* @__PURE__ */ new Map();
  var addEntity = (world3) => {
    const eid = world3[$manualEntityRecycling] ? removed.length ? removed.shift() : globalEntityCursor++ : removed.length > Math.round(globalSize * removedReuseThreshold) ? removed.shift() : globalEntityCursor++;
    if (eid > world3[$size])
      throw new Error("bitECS - max entities reached");
    world3[$entitySparseSet].add(eid);
    eidToWorld.set(eid, world3);
    world3[$notQueries].forEach((q) => {
      const match = queryCheckEntity(world3, q, eid);
      if (match)
        queryAddEntity(q, eid);
    });
    world3[$entityComponents].set(eid, /* @__PURE__ */ new Set());
    return eid;
  };
  var removeEntity = (world3, eid) => {
    if (!world3[$entitySparseSet].has(eid))
      return;
    world3[$queries].forEach((q) => {
      queryRemoveEntity(world3, q, eid);
    });
    if (world3[$manualEntityRecycling])
      recycled.push(eid);
    else
      removed.push(eid);
    world3[$entitySparseSet].remove(eid);
    world3[$entityComponents].delete(eid);
    world3[$localEntities].delete(world3[$localEntityLookup].get(eid));
    world3[$localEntityLookup].delete(eid);
    for (let i = 0; i < world3[$entityMasks].length; i++)
      world3[$entityMasks][i][eid] = 0;
  };
  var $modifier = Symbol("$modifier");
  function Any(...comps) {
    return function QueryAny() {
      return comps;
    };
  }
  function All(...comps) {
    return function QueryAll() {
      return comps;
    };
  }
  function None(...comps) {
    return function QueryNone() {
      return comps;
    };
  }
  var $queries = Symbol("queries");
  var $notQueries = Symbol("notQueries");
  var $queryAny = Symbol("queryAny");
  var $queryAll = Symbol("queryAll");
  var $queryNone = Symbol("queryNone");
  var $queryMap = Symbol("queryMap");
  var $dirtyQueries = Symbol("$dirtyQueries");
  var $queryComponents = Symbol("queryComponents");
  var $enterQuery = Symbol("enterQuery");
  var $exitQuery = Symbol("exitQuery");
  var empty = Object.freeze([]);
  var registerQuery = (world3, query2) => {
    const components2 = [];
    const notComponents = [];
    const changedComponents = [];
    query2[$queryComponents].forEach((c) => {
      if (typeof c === "function" && c[$modifier]) {
        const [comp, mod] = c();
        if (!world3[$componentMap].has(comp))
          registerComponent(world3, comp);
        if (mod === "not") {
          notComponents.push(comp);
        }
        if (mod === "changed") {
          changedComponents.push(comp);
          components2.push(comp);
        }
      } else {
        if (!world3[$componentMap].has(c))
          registerComponent(world3, c);
        components2.push(c);
      }
    });
    const mapComponents = (c) => world3[$componentMap].get(c);
    const allComponents = components2.concat(notComponents).map(mapComponents);
    const sparseSet = SparseSet();
    const archetypes = [];
    const changed = [];
    const toRemove = SparseSet();
    const entered = SparseSet();
    const exited = SparseSet();
    const generations = allComponents.map((c) => c.generationId).reduce((a, v) => {
      if (a.includes(v))
        return a;
      a.push(v);
      return a;
    }, []);
    const reduceBitflags = (a, c) => {
      if (!a[c.generationId])
        a[c.generationId] = 0;
      a[c.generationId] |= c.bitflag;
      return a;
    };
    const masks = components2.map(mapComponents).reduce(reduceBitflags, {});
    const notMasks = notComponents.map(mapComponents).reduce(reduceBitflags, {});
    const hasMasks = allComponents.reduce(reduceBitflags, {});
    const flatProps = components2.filter((c) => !c[$tagStore]).map((c) => Object.getOwnPropertySymbols(c).includes($storeFlattened) ? c[$storeFlattened] : [c]).reduce((a, v) => a.concat(v), []);
    const shadows = [];
    const q = Object.assign(sparseSet, {
      archetypes,
      changed,
      components: components2,
      notComponents,
      changedComponents,
      allComponents,
      masks,
      notMasks,
      hasMasks,
      generations,
      flatProps,
      toRemove,
      entered,
      exited,
      shadows
    });
    world3[$queryMap].set(query2, q);
    world3[$queries].add(q);
    allComponents.forEach((c) => {
      c.queries.add(q);
    });
    if (notComponents.length)
      world3[$notQueries].add(q);
    for (let eid = 0; eid < getEntityCursor(); eid++) {
      if (!world3[$entitySparseSet].has(eid))
        continue;
      const match = queryCheckEntity(world3, q, eid);
      if (match)
        queryAddEntity(q, eid);
    }
  };
  var generateShadow = (q, pid) => {
    const $ = Symbol();
    const prop = q.flatProps[pid];
    createShadow(prop, $);
    q.shadows[pid] = prop[$];
    return prop[$];
  };
  var diff = (q, clearDiff) => {
    if (clearDiff)
      q.changed = [];
    const { flatProps, shadows } = q;
    for (let i = 0; i < q.dense.length; i++) {
      const eid = q.dense[i];
      let dirty = false;
      for (let pid = 0; pid < flatProps.length; pid++) {
        const prop = flatProps[pid];
        const shadow = shadows[pid] || generateShadow(q, pid);
        if (ArrayBuffer.isView(prop[eid])) {
          for (let i2 = 0; i2 < prop[eid].length; i2++) {
            if (prop[eid][i2] !== shadow[eid][i2]) {
              dirty = true;
              break;
            }
          }
          shadow[eid].set(prop[eid]);
        } else {
          if (prop[eid] !== shadow[eid]) {
            dirty = true;
            shadow[eid] = prop[eid];
          }
        }
      }
      if (dirty)
        q.changed.push(eid);
    }
    return q.changed;
  };
  var flatten = (a, v) => a.concat(v);
  var aggregateComponentsFor = (mod) => (x) => x.filter((f) => f.name === mod().constructor.name).reduce(flatten);
  var getAnyComponents = aggregateComponentsFor(Any);
  var getAllComponents = aggregateComponentsFor(All);
  var getNoneComponents = aggregateComponentsFor(None);
  var defineQuery = (...args) => {
    let components2;
    let any, all, none;
    if (Array.isArray(args[0])) {
      components2 = args[0];
    } else {
    }
    if (components2 === void 0 || components2[$componentMap] !== void 0) {
      return (world3) => world3 ? world3[$entityArray] : components2[$entityArray];
    }
    const query2 = function(world3, clearDiff = true) {
      if (!world3[$queryMap].has(query2))
        registerQuery(world3, query2);
      const q = world3[$queryMap].get(query2);
      commitRemovals(world3);
      if (q.changedComponents.length)
        return diff(q, clearDiff);
      return q.dense;
    };
    query2[$queryComponents] = components2;
    query2[$queryAny] = any;
    query2[$queryAll] = all;
    query2[$queryNone] = none;
    return query2;
  };
  var queryCheckEntity = (world3, q, eid) => {
    const { masks, notMasks, generations } = q;
    let or = 0;
    for (let i = 0; i < generations.length; i++) {
      const generationId = generations[i];
      const qMask = masks[generationId];
      const qNotMask = notMasks[generationId];
      const eMask = world3[$entityMasks][generationId][eid];
      if (qNotMask && (eMask & qNotMask) !== 0) {
        return false;
      }
      if (qMask && (eMask & qMask) !== qMask) {
        return false;
      }
    }
    return true;
  };
  var queryAddEntity = (q, eid) => {
    q.toRemove.remove(eid);
    q.entered.add(eid);
    q.add(eid);
  };
  var queryCommitRemovals = (q) => {
    for (let i = q.toRemove.dense.length - 1; i >= 0; i--) {
      const eid = q.toRemove.dense[i];
      q.toRemove.remove(eid);
      q.remove(eid);
    }
  };
  var commitRemovals = (world3) => {
    if (!world3[$dirtyQueries].size)
      return;
    world3[$dirtyQueries].forEach(queryCommitRemovals);
    world3[$dirtyQueries].clear();
  };
  var queryRemoveEntity = (world3, q, eid) => {
    if (!q.has(eid) || q.toRemove.has(eid))
      return;
    q.toRemove.add(eid);
    world3[$dirtyQueries].add(q);
    q.exited.add(eid);
  };
  var $componentMap = Symbol("componentMap");
  var components = [];
  var defineComponent = (schema, size) => {
    const component = createStore(schema, size || getGlobalSize());
    if (schema && Object.keys(schema).length)
      components.push(component);
    return component;
  };
  var incrementBitflag = (world3) => {
    world3[$bitflag] *= 2;
    if (world3[$bitflag] >= 2 ** 31) {
      world3[$bitflag] = 1;
      world3[$entityMasks].push(new Uint32Array(world3[$size]));
    }
  };
  var registerComponent = (world3, component) => {
    if (!component)
      throw new Error(`bitECS - Cannot register null or undefined component`);
    const queries = /* @__PURE__ */ new Set();
    const notQueries = /* @__PURE__ */ new Set();
    const changedQueries = /* @__PURE__ */ new Set();
    world3[$queries].forEach((q) => {
      if (q.allComponents.includes(component)) {
        queries.add(q);
      }
    });
    world3[$componentMap].set(component, {
      generationId: world3[$entityMasks].length - 1,
      bitflag: world3[$bitflag],
      store: component,
      queries,
      notQueries,
      changedQueries
    });
    incrementBitflag(world3);
  };
  var hasComponent = (world3, component, eid) => {
    const registeredComponent = world3[$componentMap].get(component);
    if (!registeredComponent)
      return false;
    const { generationId, bitflag } = registeredComponent;
    const mask = world3[$entityMasks][generationId][eid];
    return (mask & bitflag) === bitflag;
  };
  var addComponent = (world3, component, eid, reset = false) => {
    if (eid === void 0)
      throw new Error("bitECS - entity is undefined.");
    if (!world3[$entitySparseSet].has(eid))
      throw new Error("bitECS - entity does not exist in the world.");
    if (!world3[$componentMap].has(component))
      registerComponent(world3, component);
    if (hasComponent(world3, component, eid))
      return;
    const c = world3[$componentMap].get(component);
    const { generationId, bitflag, queries, notQueries } = c;
    world3[$entityMasks][generationId][eid] |= bitflag;
    queries.forEach((q) => {
      q.toRemove.remove(eid);
      const match = queryCheckEntity(world3, q, eid);
      if (match) {
        q.exited.remove(eid);
        queryAddEntity(q, eid);
      }
      if (!match) {
        q.entered.remove(eid);
        queryRemoveEntity(world3, q, eid);
      }
    });
    world3[$entityComponents].get(eid).add(component);
    if (reset)
      resetStoreFor(component, eid);
  };
  var $size = Symbol("size");
  var $resizeThreshold = Symbol("resizeThreshold");
  var $bitflag = Symbol("bitflag");
  var $archetypes = Symbol("archetypes");
  var $localEntities = Symbol("localEntities");
  var $localEntityLookup = Symbol("localEntityLookup");
  var $manualEntityRecycling = Symbol("manualEntityRecycling");
  var worlds = [];
  var createWorld = (...args) => {
    const world3 = typeof args[0] === "object" ? args[0] : {};
    const size = typeof args[0] === "number" ? args[0] : typeof args[1] === "number" ? args[1] : getGlobalSize();
    resetWorld(world3, size);
    worlds.push(world3);
    return world3;
  };
  var resetWorld = (world3, size = getGlobalSize()) => {
    world3[$size] = size;
    if (world3[$entityArray])
      world3[$entityArray].forEach((eid) => removeEntity(world3, eid));
    world3[$entityMasks] = [new Uint32Array(size)];
    world3[$entityComponents] = /* @__PURE__ */ new Map();
    world3[$archetypes] = [];
    world3[$entitySparseSet] = SparseSet();
    world3[$entityArray] = world3[$entitySparseSet].dense;
    world3[$bitflag] = 1;
    world3[$componentMap] = /* @__PURE__ */ new Map();
    world3[$queryMap] = /* @__PURE__ */ new Map();
    world3[$queries] = /* @__PURE__ */ new Set();
    world3[$notQueries] = /* @__PURE__ */ new Set();
    world3[$dirtyQueries] = /* @__PURE__ */ new Set();
    world3[$localEntities] = /* @__PURE__ */ new Map();
    world3[$localEntityLookup] = /* @__PURE__ */ new Map();
    world3[$manualEntityRecycling] = false;
    return world3;
  };
  var Types = TYPES_ENUM;

  // src/engine/render/classes/pass.ts
  var Pass = class {
    constructor(device, vertexShader, fragmentShader, format = "bgra8unorm") {
      this.pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: device.createShaderModule({ code: vertexShader }),
          entryPoint: "vs_main",
          buffers: [
            {
              arrayStride: 3 * 4,
              // 3 floats * 4 bytes = 12 bytes per vertex
              attributes: [
                {
                  shaderLocation: 0,
                  // matches @location(0)
                  offset: 0,
                  format: "float32x3"
                  // vec3<f32>
                }
              ]
            }
          ]
        },
        fragment: {
          module: device.createShaderModule({ code: fragmentShader }),
          entryPoint: "fs_main",
          targets: [
            {
              format
            }
          ]
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "back"
        },
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: true,
          depthCompare: "less"
        }
      });
    }
    getPipeline() {
      return this.pipeline;
    }
  };

  // src/engine/render/classes/pipeline.ts
  var Pipeline = class {
    constructor(device, width, height, colorFormat) {
      this.device = device;
      this.colorFormat = colorFormat;
      this.passes = /* @__PURE__ */ new Map();
      width = Math.max(1, width | 0);
      height = Math.max(1, height | 0);
      this.depthTexture = this.createDepthTexture(width, height);
      this.depthTextureView = this.depthTexture.createView();
      this.colorTexture = this.createColorTexture(width, height, colorFormat);
      this.colorTextureView = this.colorTexture.createView();
    }
    createDepthTexture(width, height) {
      return this.device.createTexture({
        size: { width, height },
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
    }
    createColorTexture(width, height, format) {
      return this.device.createTexture({
        size: { width, height },
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
    }
    getDepthTextureView() {
      return this.depthTextureView;
    }
    getColorTextureView() {
      return this.colorTextureView;
    }
    addPass(id, vertexShader, fragmentShader, format) {
      const pass = new Pass(this.device, vertexShader, fragmentShader, format);
      this.passes.set(id, pass);
    }
    getPass(id) {
      return this.passes.get(id);
    }
    tick(delta, passEncoder) {
    }
  };

  // src/game/components/transform.ts
  var Transform = defineComponent({
    x: Types.f32,
    y: Types.f32,
    z: Types.f32,
    scale: Types.f32
  });

  // src/game/components/renderInstance.ts
  var Renderable = defineComponent({
    meshId: Types.ui16,
    materialId: Types.ui8
  });

  // src/game/components/glowyEdge.ts
  var GlowyEdge = defineComponent({
    mask: Types.ui32
  });

  // src/game/world/index.ts
  var world;
  var uniformBuffers = /* @__PURE__ */ new Map();
  var bindGroups = /* @__PURE__ */ new Map();
  var inBounds = (x, y, z, size) => x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size;
  function isVoxelSolid(x, y, z, size, thickness) {
    if (!inBounds(x, y, z, size)) return false;
    const halfSize = size / 2;
    const halfThickness = thickness / 2;
    const centerMin = halfSize - halfThickness;
    const centerMax = halfSize + halfThickness;
    const inX = x >= centerMin && x < centerMax;
    const inY = y >= centerMin && y < centerMax;
    const inZ = z >= centerMin && z < centerMax;
    const centerCount = (inX ? 1 : 0) + (inY ? 1 : 0) + (inZ ? 1 : 0);
    const isOnSurface = x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1;
    return centerCount >= 1 && centerCount < 3 && isOnSurface;
  }
  var emptyInterior = (x, y, z, size, thickness) => inBounds(x, y, z, size) && !isVoxelSolid(x, y, z, size, thickness);
  function edgeMaskForVoxel(x, y, z, size, thickness) {
    if (!isVoxelSolid(x, y, z, size, thickness)) return 0;
    let mask = 0;
    if (emptyInterior(x, y + 1, z, size, thickness) && emptyInterior(x, y, z + 1, size, thickness))
      mask |= 256 /* X_PosY_PosZ */;
    if (emptyInterior(x, y + 1, z, size, thickness) && emptyInterior(x, y, z - 1, size, thickness))
      mask |= 512 /* X_PosY_NegZ */;
    if (emptyInterior(x, y - 1, z, size, thickness) && emptyInterior(x, y, z + 1, size, thickness))
      mask |= 1024 /* X_NegY_PosZ */;
    if (emptyInterior(x, y - 1, z, size, thickness) && emptyInterior(x, y, z - 1, size, thickness))
      mask |= 2048 /* X_NegY_NegZ */;
    if (emptyInterior(x + 1, y, z, size, thickness) && emptyInterior(x, y, z + 1, size, thickness))
      mask |= 16 /* Y_PosX_PosZ */;
    if (emptyInterior(x + 1, y, z, size, thickness) && emptyInterior(x, y, z - 1, size, thickness))
      mask |= 32 /* Y_PosX_NegZ */;
    if (emptyInterior(x - 1, y, z, size, thickness) && emptyInterior(x, y, z + 1, size, thickness))
      mask |= 64 /* Y_NegX_PosZ */;
    if (emptyInterior(x - 1, y, z, size, thickness) && emptyInterior(x, y, z - 1, size, thickness))
      mask |= 128 /* Y_NegX_NegZ */;
    if (emptyInterior(x + 1, y, z, size, thickness) && emptyInterior(x, y + 1, z, size, thickness))
      mask |= 1 /* Z_PosX_PosY */;
    if (emptyInterior(x + 1, y, z, size, thickness) && emptyInterior(x, y - 1, z, size, thickness))
      mask |= 2 /* Z_PosX_NegY */;
    if (emptyInterior(x - 1, y, z, size, thickness) && emptyInterior(x, y + 1, z, size, thickness))
      mask |= 4 /* Z_NegX_PosY */;
    if (emptyInterior(x - 1, y, z, size, thickness) && emptyInterior(x, y - 1, z, size, thickness))
      mask |= 8 /* Z_NegX_NegY */;
    return mask;
  }
  function spawnCubes(meshId, bindGroupLayout, size = 20, spacing = 1, thickness = 5) {
    console.log(`[render/init.ts::spawnCubes] - meshId : ${meshId}`);
    const device = renderData.device;
    const halfSize = size / 2;
    const halfThickness = thickness / 2;
    const centerMin = halfSize - halfThickness;
    const centerMax = halfSize + halfThickness;
    function isInCenter(v) {
      return v >= centerMin && v < centerMax;
    }
    function createEntityWithGPU(x, y, z, edgeMask) {
      const eid = addEntity(world);
      addComponent(world, Transform, eid);
      addComponent(world, GlowyEdge, eid);
      GlowyEdge.mask[eid] = edgeMask;
      Transform.x[eid] = x;
      Transform.y[eid] = y;
      Transform.z[eid] = z;
      const modelMatrix = createModelMatrix(x, y, z);
      const uniformBuffer = device.createBuffer({
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(
        uniformBuffer,
        0,
        modelMatrix.buffer,
        modelMatrix.byteOffset,
        modelMatrix.byteLength
      );
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer }
          }
        ]
      });
      addComponent(world, Renderable, eid);
      Renderable.meshId[eid] = meshId;
      Renderable.materialId[eid] = 0;
      uniformBuffers.set(eid, uniformBuffer);
      bindGroups.set(eid, bindGroup);
    }
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const inX = isInCenter(x);
          const inY = isInCenter(y);
          const inZ = isInCenter(z);
          const centerCount = [inX, inY, inZ].filter(Boolean).length;
          const isOnSurface = x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1;
          if (centerCount >= 1 && centerCount < 3 && isOnSurface) {
            const mask = edgeMaskForVoxel(
              x,
              y,
              z,
              size,
              thickness
            );
            createEntityWithGPU(
              (x - halfSize) * spacing,
              (y - halfSize) * spacing,
              (z - halfSize) * spacing,
              mask
            );
          }
        }
      }
    }
  }
  function initializeWorld(meshId, bindGroupLayout) {
    world = createWorld();
    spawnCubes(meshId, bindGroupLayout, 20, 1, 6);
  }

  // node_modules/gl-matrix/esm/common.js
  var EPSILON = 1e-6;
  var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
  var RANDOM = Math.random;
  function round(a) {
    if (a >= 0) return Math.round(a);
    return a % 0.5 === 0 ? Math.floor(a) : Math.round(a);
  }
  var degree = Math.PI / 180;
  var radian = 180 / Math.PI;

  // node_modules/gl-matrix/esm/mat4.js
  var mat4_exports = {};
  __export(mat4_exports, {
    add: () => add,
    adjoint: () => adjoint,
    clone: () => clone,
    copy: () => copy,
    create: () => create,
    decompose: () => decompose,
    determinant: () => determinant,
    equals: () => equals,
    exactEquals: () => exactEquals,
    frob: () => frob,
    fromQuat: () => fromQuat,
    fromQuat2: () => fromQuat2,
    fromRotation: () => fromRotation,
    fromRotationTranslation: () => fromRotationTranslation,
    fromRotationTranslationScale: () => fromRotationTranslationScale,
    fromRotationTranslationScaleOrigin: () => fromRotationTranslationScaleOrigin,
    fromScaling: () => fromScaling,
    fromTranslation: () => fromTranslation,
    fromValues: () => fromValues,
    fromXRotation: () => fromXRotation,
    fromYRotation: () => fromYRotation,
    fromZRotation: () => fromZRotation,
    frustum: () => frustum,
    getRotation: () => getRotation,
    getScaling: () => getScaling,
    getTranslation: () => getTranslation,
    identity: () => identity,
    invert: () => invert,
    lookAt: () => lookAt,
    mul: () => mul,
    multiply: () => multiply,
    multiplyScalar: () => multiplyScalar,
    multiplyScalarAndAdd: () => multiplyScalarAndAdd,
    ortho: () => ortho,
    orthoNO: () => orthoNO,
    orthoZO: () => orthoZO,
    perspective: () => perspective,
    perspectiveFromFieldOfView: () => perspectiveFromFieldOfView,
    perspectiveNO: () => perspectiveNO,
    perspectiveZO: () => perspectiveZO,
    rotate: () => rotate,
    rotateX: () => rotateX,
    rotateY: () => rotateY,
    rotateZ: () => rotateZ,
    scale: () => scale,
    set: () => set,
    str: () => str,
    sub: () => sub,
    subtract: () => subtract,
    targetTo: () => targetTo,
    translate: () => translate,
    transpose: () => transpose
  });
  function create() {
    var out = new ARRAY_TYPE(16);
    if (ARRAY_TYPE != Float32Array) {
      out[1] = 0;
      out[2] = 0;
      out[3] = 0;
      out[4] = 0;
      out[6] = 0;
      out[7] = 0;
      out[8] = 0;
      out[9] = 0;
      out[11] = 0;
      out[12] = 0;
      out[13] = 0;
      out[14] = 0;
    }
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
  }
  function clone(a) {
    var out = new ARRAY_TYPE(16);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
  }
  function copy(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
  }
  function fromValues(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
    var out = new ARRAY_TYPE(16);
    out[0] = m00;
    out[1] = m01;
    out[2] = m02;
    out[3] = m03;
    out[4] = m10;
    out[5] = m11;
    out[6] = m12;
    out[7] = m13;
    out[8] = m20;
    out[9] = m21;
    out[10] = m22;
    out[11] = m23;
    out[12] = m30;
    out[13] = m31;
    out[14] = m32;
    out[15] = m33;
    return out;
  }
  function set(out, m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
    out[0] = m00;
    out[1] = m01;
    out[2] = m02;
    out[3] = m03;
    out[4] = m10;
    out[5] = m11;
    out[6] = m12;
    out[7] = m13;
    out[8] = m20;
    out[9] = m21;
    out[10] = m22;
    out[11] = m23;
    out[12] = m30;
    out[13] = m31;
    out[14] = m32;
    out[15] = m33;
    return out;
  }
  function identity(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  function transpose(out, a) {
    if (out === a) {
      var a01 = a[1], a02 = a[2], a03 = a[3];
      var a12 = a[6], a13 = a[7];
      var a23 = a[11];
      out[1] = a[4];
      out[2] = a[8];
      out[3] = a[12];
      out[4] = a01;
      out[6] = a[9];
      out[7] = a[13];
      out[8] = a02;
      out[9] = a12;
      out[11] = a[14];
      out[12] = a03;
      out[13] = a13;
      out[14] = a23;
    } else {
      out[0] = a[0];
      out[1] = a[4];
      out[2] = a[8];
      out[3] = a[12];
      out[4] = a[1];
      out[5] = a[5];
      out[6] = a[9];
      out[7] = a[13];
      out[8] = a[2];
      out[9] = a[6];
      out[10] = a[10];
      out[11] = a[14];
      out[12] = a[3];
      out[13] = a[7];
      out[14] = a[11];
      out[15] = a[15];
    }
    return out;
  }
  function invert(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10;
    var b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11;
    var b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30;
    var b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31;
    var b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) {
      return null;
    }
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
  function adjoint(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10;
    var b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11;
    var b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30;
    var b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31;
    var b11 = a22 * a33 - a23 * a32;
    out[0] = a11 * b11 - a12 * b10 + a13 * b09;
    out[1] = a02 * b10 - a01 * b11 - a03 * b09;
    out[2] = a31 * b05 - a32 * b04 + a33 * b03;
    out[3] = a22 * b04 - a21 * b05 - a23 * b03;
    out[4] = a12 * b08 - a10 * b11 - a13 * b07;
    out[5] = a00 * b11 - a02 * b08 + a03 * b07;
    out[6] = a32 * b02 - a30 * b05 - a33 * b01;
    out[7] = a20 * b05 - a22 * b02 + a23 * b01;
    out[8] = a10 * b10 - a11 * b08 + a13 * b06;
    out[9] = a01 * b08 - a00 * b10 - a03 * b06;
    out[10] = a30 * b04 - a31 * b02 + a33 * b00;
    out[11] = a21 * b02 - a20 * b04 - a23 * b00;
    out[12] = a11 * b07 - a10 * b09 - a12 * b06;
    out[13] = a00 * b09 - a01 * b07 + a02 * b06;
    out[14] = a31 * b01 - a30 * b03 - a32 * b00;
    out[15] = a20 * b03 - a21 * b01 + a22 * b00;
    return out;
  }
  function determinant(a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b0 = a00 * a11 - a01 * a10;
    var b1 = a00 * a12 - a02 * a10;
    var b2 = a01 * a12 - a02 * a11;
    var b3 = a20 * a31 - a21 * a30;
    var b4 = a20 * a32 - a22 * a30;
    var b5 = a21 * a32 - a22 * a31;
    var b6 = a00 * b5 - a01 * b4 + a02 * b3;
    var b7 = a10 * b5 - a11 * b4 + a12 * b3;
    var b8 = a20 * b2 - a21 * b1 + a22 * b0;
    var b9 = a30 * b2 - a31 * b1 + a32 * b0;
    return a13 * b6 - a03 * b7 + a33 * b8 - a23 * b9;
  }
  function multiply(out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  }
  function translate(out, a, v) {
    var x = v[0], y = v[1], z = v[2];
    var a00, a01, a02, a03;
    var a10, a11, a12, a13;
    var a20, a21, a22, a23;
    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
      a00 = a[0];
      a01 = a[1];
      a02 = a[2];
      a03 = a[3];
      a10 = a[4];
      a11 = a[5];
      a12 = a[6];
      a13 = a[7];
      a20 = a[8];
      a21 = a[9];
      a22 = a[10];
      a23 = a[11];
      out[0] = a00;
      out[1] = a01;
      out[2] = a02;
      out[3] = a03;
      out[4] = a10;
      out[5] = a11;
      out[6] = a12;
      out[7] = a13;
      out[8] = a20;
      out[9] = a21;
      out[10] = a22;
      out[11] = a23;
      out[12] = a00 * x + a10 * y + a20 * z + a[12];
      out[13] = a01 * x + a11 * y + a21 * z + a[13];
      out[14] = a02 * x + a12 * y + a22 * z + a[14];
      out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }
    return out;
  }
  function scale(out, a, v) {
    var x = v[0], y = v[1], z = v[2];
    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
  }
  function rotate(out, a, rad, axis) {
    var x = axis[0], y = axis[1], z = axis[2];
    var len2 = Math.sqrt(x * x + y * y + z * z);
    var s, c, t;
    var a00, a01, a02, a03;
    var a10, a11, a12, a13;
    var a20, a21, a22, a23;
    var b00, b01, b02;
    var b10, b11, b12;
    var b20, b21, b22;
    if (len2 < EPSILON) {
      return null;
    }
    len2 = 1 / len2;
    x *= len2;
    y *= len2;
    z *= len2;
    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    b00 = x * x * t + c;
    b01 = y * x * t + z * s;
    b02 = z * x * t - y * s;
    b10 = x * y * t - z * s;
    b11 = y * y * t + c;
    b12 = z * y * t + x * s;
    b20 = x * z * t + y * s;
    b21 = y * z * t - x * s;
    b22 = z * z * t + c;
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;
    if (a !== out) {
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    }
    return out;
  }
  function rotateX(out, a, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var a10 = a[4];
    var a11 = a[5];
    var a12 = a[6];
    var a13 = a[7];
    var a20 = a[8];
    var a21 = a[9];
    var a22 = a[10];
    var a23 = a[11];
    if (a !== out) {
      out[0] = a[0];
      out[1] = a[1];
      out[2] = a[2];
      out[3] = a[3];
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    }
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
  }
  function rotateY(out, a, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var a00 = a[0];
    var a01 = a[1];
    var a02 = a[2];
    var a03 = a[3];
    var a20 = a[8];
    var a21 = a[9];
    var a22 = a[10];
    var a23 = a[11];
    if (a !== out) {
      out[4] = a[4];
      out[5] = a[5];
      out[6] = a[6];
      out[7] = a[7];
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    }
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
  }
  function rotateZ(out, a, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    var a00 = a[0];
    var a01 = a[1];
    var a02 = a[2];
    var a03 = a[3];
    var a10 = a[4];
    var a11 = a[5];
    var a12 = a[6];
    var a13 = a[7];
    if (a !== out) {
      out[8] = a[8];
      out[9] = a[9];
      out[10] = a[10];
      out[11] = a[11];
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    }
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
  }
  function fromTranslation(out, v) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    return out;
  }
  function fromScaling(out, v) {
    out[0] = v[0];
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = v[1];
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = v[2];
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  function fromRotation(out, rad, axis) {
    var x = axis[0], y = axis[1], z = axis[2];
    var len2 = Math.sqrt(x * x + y * y + z * z);
    var s, c, t;
    if (len2 < EPSILON) {
      return null;
    }
    len2 = 1 / len2;
    x *= len2;
    y *= len2;
    z *= len2;
    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;
    out[0] = x * x * t + c;
    out[1] = y * x * t + z * s;
    out[2] = z * x * t - y * s;
    out[3] = 0;
    out[4] = x * y * t - z * s;
    out[5] = y * y * t + c;
    out[6] = z * y * t + x * s;
    out[7] = 0;
    out[8] = x * z * t + y * s;
    out[9] = y * z * t - x * s;
    out[10] = z * z * t + c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  function fromXRotation(out, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = c;
    out[6] = s;
    out[7] = 0;
    out[8] = 0;
    out[9] = -s;
    out[10] = c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  function fromYRotation(out, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    out[0] = c;
    out[1] = 0;
    out[2] = -s;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = s;
    out[9] = 0;
    out[10] = c;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  function fromZRotation(out, rad) {
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    out[0] = c;
    out[1] = s;
    out[2] = 0;
    out[3] = 0;
    out[4] = -s;
    out[5] = c;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  function fromRotationTranslation(out, q, v) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var xy = x * y2;
    var xz = x * z2;
    var yy = y * y2;
    var yz = y * z2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    return out;
  }
  function fromQuat2(out, a) {
    var translation = new ARRAY_TYPE(3);
    var bx = -a[0], by = -a[1], bz = -a[2], bw = a[3], ax = a[4], ay = a[5], az = a[6], aw = a[7];
    var magnitude = bx * bx + by * by + bz * bz + bw * bw;
    if (magnitude > 0) {
      translation[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2 / magnitude;
      translation[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2 / magnitude;
      translation[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2 / magnitude;
    } else {
      translation[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2;
      translation[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2;
      translation[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2;
    }
    fromRotationTranslation(out, a, translation);
    return out;
  }
  function getTranslation(out, mat) {
    out[0] = mat[12];
    out[1] = mat[13];
    out[2] = mat[14];
    return out;
  }
  function getScaling(out, mat) {
    var m11 = mat[0];
    var m12 = mat[1];
    var m13 = mat[2];
    var m21 = mat[4];
    var m22 = mat[5];
    var m23 = mat[6];
    var m31 = mat[8];
    var m32 = mat[9];
    var m33 = mat[10];
    out[0] = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
    out[1] = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
    out[2] = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);
    return out;
  }
  function getRotation(out, mat) {
    var scaling = new ARRAY_TYPE(3);
    getScaling(scaling, mat);
    var is1 = 1 / scaling[0];
    var is2 = 1 / scaling[1];
    var is3 = 1 / scaling[2];
    var sm11 = mat[0] * is1;
    var sm12 = mat[1] * is2;
    var sm13 = mat[2] * is3;
    var sm21 = mat[4] * is1;
    var sm22 = mat[5] * is2;
    var sm23 = mat[6] * is3;
    var sm31 = mat[8] * is1;
    var sm32 = mat[9] * is2;
    var sm33 = mat[10] * is3;
    var trace = sm11 + sm22 + sm33;
    var S = 0;
    if (trace > 0) {
      S = Math.sqrt(trace + 1) * 2;
      out[3] = 0.25 * S;
      out[0] = (sm23 - sm32) / S;
      out[1] = (sm31 - sm13) / S;
      out[2] = (sm12 - sm21) / S;
    } else if (sm11 > sm22 && sm11 > sm33) {
      S = Math.sqrt(1 + sm11 - sm22 - sm33) * 2;
      out[3] = (sm23 - sm32) / S;
      out[0] = 0.25 * S;
      out[1] = (sm12 + sm21) / S;
      out[2] = (sm31 + sm13) / S;
    } else if (sm22 > sm33) {
      S = Math.sqrt(1 + sm22 - sm11 - sm33) * 2;
      out[3] = (sm31 - sm13) / S;
      out[0] = (sm12 + sm21) / S;
      out[1] = 0.25 * S;
      out[2] = (sm23 + sm32) / S;
    } else {
      S = Math.sqrt(1 + sm33 - sm11 - sm22) * 2;
      out[3] = (sm12 - sm21) / S;
      out[0] = (sm31 + sm13) / S;
      out[1] = (sm23 + sm32) / S;
      out[2] = 0.25 * S;
    }
    return out;
  }
  function decompose(out_r, out_t, out_s, mat) {
    out_t[0] = mat[12];
    out_t[1] = mat[13];
    out_t[2] = mat[14];
    var m11 = mat[0];
    var m12 = mat[1];
    var m13 = mat[2];
    var m21 = mat[4];
    var m22 = mat[5];
    var m23 = mat[6];
    var m31 = mat[8];
    var m32 = mat[9];
    var m33 = mat[10];
    out_s[0] = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
    out_s[1] = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
    out_s[2] = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);
    var is1 = 1 / out_s[0];
    var is2 = 1 / out_s[1];
    var is3 = 1 / out_s[2];
    var sm11 = m11 * is1;
    var sm12 = m12 * is2;
    var sm13 = m13 * is3;
    var sm21 = m21 * is1;
    var sm22 = m22 * is2;
    var sm23 = m23 * is3;
    var sm31 = m31 * is1;
    var sm32 = m32 * is2;
    var sm33 = m33 * is3;
    var trace = sm11 + sm22 + sm33;
    var S = 0;
    if (trace > 0) {
      S = Math.sqrt(trace + 1) * 2;
      out_r[3] = 0.25 * S;
      out_r[0] = (sm23 - sm32) / S;
      out_r[1] = (sm31 - sm13) / S;
      out_r[2] = (sm12 - sm21) / S;
    } else if (sm11 > sm22 && sm11 > sm33) {
      S = Math.sqrt(1 + sm11 - sm22 - sm33) * 2;
      out_r[3] = (sm23 - sm32) / S;
      out_r[0] = 0.25 * S;
      out_r[1] = (sm12 + sm21) / S;
      out_r[2] = (sm31 + sm13) / S;
    } else if (sm22 > sm33) {
      S = Math.sqrt(1 + sm22 - sm11 - sm33) * 2;
      out_r[3] = (sm31 - sm13) / S;
      out_r[0] = (sm12 + sm21) / S;
      out_r[1] = 0.25 * S;
      out_r[2] = (sm23 + sm32) / S;
    } else {
      S = Math.sqrt(1 + sm33 - sm11 - sm22) * 2;
      out_r[3] = (sm12 - sm21) / S;
      out_r[0] = (sm31 + sm13) / S;
      out_r[1] = (sm23 + sm32) / S;
      out_r[2] = 0.25 * S;
    }
    return out_r;
  }
  function fromRotationTranslationScale(out, q, v, s) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var xy = x * y2;
    var xz = x * z2;
    var yy = y * y2;
    var yz = y * z2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    var sx = s[0];
    var sy = s[1];
    var sz = s[2];
    out[0] = (1 - (yy + zz)) * sx;
    out[1] = (xy + wz) * sx;
    out[2] = (xz - wy) * sx;
    out[3] = 0;
    out[4] = (xy - wz) * sy;
    out[5] = (1 - (xx + zz)) * sy;
    out[6] = (yz + wx) * sy;
    out[7] = 0;
    out[8] = (xz + wy) * sz;
    out[9] = (yz - wx) * sz;
    out[10] = (1 - (xx + yy)) * sz;
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    return out;
  }
  function fromRotationTranslationScaleOrigin(out, q, v, s, o) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var xy = x * y2;
    var xz = x * z2;
    var yy = y * y2;
    var yz = y * z2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    var sx = s[0];
    var sy = s[1];
    var sz = s[2];
    var ox = o[0];
    var oy = o[1];
    var oz = o[2];
    var out0 = (1 - (yy + zz)) * sx;
    var out1 = (xy + wz) * sx;
    var out2 = (xz - wy) * sx;
    var out4 = (xy - wz) * sy;
    var out5 = (1 - (xx + zz)) * sy;
    var out6 = (yz + wx) * sy;
    var out8 = (xz + wy) * sz;
    var out9 = (yz - wx) * sz;
    var out10 = (1 - (xx + yy)) * sz;
    out[0] = out0;
    out[1] = out1;
    out[2] = out2;
    out[3] = 0;
    out[4] = out4;
    out[5] = out5;
    out[6] = out6;
    out[7] = 0;
    out[8] = out8;
    out[9] = out9;
    out[10] = out10;
    out[11] = 0;
    out[12] = v[0] + ox - (out0 * ox + out4 * oy + out8 * oz);
    out[13] = v[1] + oy - (out1 * ox + out5 * oy + out9 * oz);
    out[14] = v[2] + oz - (out2 * ox + out6 * oy + out10 * oz);
    out[15] = 1;
    return out;
  }
  function fromQuat(out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var x2 = x + x;
    var y2 = y + y;
    var z2 = z + z;
    var xx = x * x2;
    var yx = y * x2;
    var yy = y * y2;
    var zx = z * x2;
    var zy = z * y2;
    var zz = z * z2;
    var wx = w * x2;
    var wy = w * y2;
    var wz = w * z2;
    out[0] = 1 - yy - zz;
    out[1] = yx + wz;
    out[2] = zx - wy;
    out[3] = 0;
    out[4] = yx - wz;
    out[5] = 1 - xx - zz;
    out[6] = zy + wx;
    out[7] = 0;
    out[8] = zx + wy;
    out[9] = zy - wx;
    out[10] = 1 - xx - yy;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  }
  function frustum(out, left, right, bottom, top, near, far) {
    var rl = 1 / (right - left);
    var tb = 1 / (top - bottom);
    var nf = 1 / (near - far);
    out[0] = near * 2 * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = near * 2 * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = far * near * 2 * nf;
    out[15] = 0;
    return out;
  }
  function perspectiveNO(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[15] = 0;
    if (far != null && far !== Infinity) {
      var nf = 1 / (near - far);
      out[10] = (far + near) * nf;
      out[14] = 2 * far * near * nf;
    } else {
      out[10] = -1;
      out[14] = -2 * near;
    }
    return out;
  }
  var perspective = perspectiveNO;
  function perspectiveZO(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[15] = 0;
    if (far != null && far !== Infinity) {
      var nf = 1 / (near - far);
      out[10] = far * nf;
      out[14] = far * near * nf;
    } else {
      out[10] = -1;
      out[14] = -near;
    }
    return out;
  }
  function perspectiveFromFieldOfView(out, fov, near, far) {
    var upTan = Math.tan(fov.upDegrees * Math.PI / 180);
    var downTan = Math.tan(fov.downDegrees * Math.PI / 180);
    var leftTan = Math.tan(fov.leftDegrees * Math.PI / 180);
    var rightTan = Math.tan(fov.rightDegrees * Math.PI / 180);
    var xScale = 2 / (leftTan + rightTan);
    var yScale = 2 / (upTan + downTan);
    out[0] = xScale;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = yScale;
    out[6] = 0;
    out[7] = 0;
    out[8] = -((leftTan - rightTan) * xScale * 0.5);
    out[9] = (upTan - downTan) * yScale * 0.5;
    out[10] = far / (near - far);
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = far * near / (near - far);
    out[15] = 0;
    return out;
  }
  function orthoNO(out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right);
    var bt = 1 / (bottom - top);
    var nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
  }
  var ortho = orthoNO;
  function orthoZO(out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right);
    var bt = 1 / (bottom - top);
    var nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = near * nf;
    out[15] = 1;
    return out;
  }
  function lookAt(out, eye, center, up) {
    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len2;
    var eyex = eye[0];
    var eyey = eye[1];
    var eyez = eye[2];
    var upx = up[0];
    var upy = up[1];
    var upz = up[2];
    var centerx = center[0];
    var centery = center[1];
    var centerz = center[2];
    if (Math.abs(eyex - centerx) < EPSILON && Math.abs(eyey - centery) < EPSILON && Math.abs(eyez - centerz) < EPSILON) {
      return identity(out);
    }
    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;
    len2 = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len2;
    z1 *= len2;
    z2 *= len2;
    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len2 = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len2) {
      x0 = 0;
      x1 = 0;
      x2 = 0;
    } else {
      len2 = 1 / len2;
      x0 *= len2;
      x1 *= len2;
      x2 *= len2;
    }
    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;
    len2 = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len2) {
      y0 = 0;
      y1 = 0;
      y2 = 0;
    } else {
      len2 = 1 / len2;
      y0 *= len2;
      y1 *= len2;
      y2 *= len2;
    }
    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
    return out;
  }
  function targetTo(out, eye, target, up) {
    var eyex = eye[0], eyey = eye[1], eyez = eye[2], upx = up[0], upy = up[1], upz = up[2];
    var z0 = eyex - target[0], z1 = eyey - target[1], z2 = eyez - target[2];
    var len2 = z0 * z0 + z1 * z1 + z2 * z2;
    if (len2 > 0) {
      len2 = 1 / Math.sqrt(len2);
      z0 *= len2;
      z1 *= len2;
      z2 *= len2;
    }
    var x0 = upy * z2 - upz * z1, x1 = upz * z0 - upx * z2, x2 = upx * z1 - upy * z0;
    len2 = x0 * x0 + x1 * x1 + x2 * x2;
    if (len2 > 0) {
      len2 = 1 / Math.sqrt(len2);
      x0 *= len2;
      x1 *= len2;
      x2 *= len2;
    }
    out[0] = x0;
    out[1] = x1;
    out[2] = x2;
    out[3] = 0;
    out[4] = z1 * x2 - z2 * x1;
    out[5] = z2 * x0 - z0 * x2;
    out[6] = z0 * x1 - z1 * x0;
    out[7] = 0;
    out[8] = z0;
    out[9] = z1;
    out[10] = z2;
    out[11] = 0;
    out[12] = eyex;
    out[13] = eyey;
    out[14] = eyez;
    out[15] = 1;
    return out;
  }
  function str(a) {
    return "mat4(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ", " + a[4] + ", " + a[5] + ", " + a[6] + ", " + a[7] + ", " + a[8] + ", " + a[9] + ", " + a[10] + ", " + a[11] + ", " + a[12] + ", " + a[13] + ", " + a[14] + ", " + a[15] + ")";
  }
  function frob(a) {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3] + a[4] * a[4] + a[5] * a[5] + a[6] * a[6] + a[7] * a[7] + a[8] * a[8] + a[9] * a[9] + a[10] * a[10] + a[11] * a[11] + a[12] * a[12] + a[13] * a[13] + a[14] * a[14] + a[15] * a[15]);
  }
  function add(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    out[3] = a[3] + b[3];
    out[4] = a[4] + b[4];
    out[5] = a[5] + b[5];
    out[6] = a[6] + b[6];
    out[7] = a[7] + b[7];
    out[8] = a[8] + b[8];
    out[9] = a[9] + b[9];
    out[10] = a[10] + b[10];
    out[11] = a[11] + b[11];
    out[12] = a[12] + b[12];
    out[13] = a[13] + b[13];
    out[14] = a[14] + b[14];
    out[15] = a[15] + b[15];
    return out;
  }
  function subtract(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    out[3] = a[3] - b[3];
    out[4] = a[4] - b[4];
    out[5] = a[5] - b[5];
    out[6] = a[6] - b[6];
    out[7] = a[7] - b[7];
    out[8] = a[8] - b[8];
    out[9] = a[9] - b[9];
    out[10] = a[10] - b[10];
    out[11] = a[11] - b[11];
    out[12] = a[12] - b[12];
    out[13] = a[13] - b[13];
    out[14] = a[14] - b[14];
    out[15] = a[15] - b[15];
    return out;
  }
  function multiplyScalar(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    out[3] = a[3] * b;
    out[4] = a[4] * b;
    out[5] = a[5] * b;
    out[6] = a[6] * b;
    out[7] = a[7] * b;
    out[8] = a[8] * b;
    out[9] = a[9] * b;
    out[10] = a[10] * b;
    out[11] = a[11] * b;
    out[12] = a[12] * b;
    out[13] = a[13] * b;
    out[14] = a[14] * b;
    out[15] = a[15] * b;
    return out;
  }
  function multiplyScalarAndAdd(out, a, b, scale3) {
    out[0] = a[0] + b[0] * scale3;
    out[1] = a[1] + b[1] * scale3;
    out[2] = a[2] + b[2] * scale3;
    out[3] = a[3] + b[3] * scale3;
    out[4] = a[4] + b[4] * scale3;
    out[5] = a[5] + b[5] * scale3;
    out[6] = a[6] + b[6] * scale3;
    out[7] = a[7] + b[7] * scale3;
    out[8] = a[8] + b[8] * scale3;
    out[9] = a[9] + b[9] * scale3;
    out[10] = a[10] + b[10] * scale3;
    out[11] = a[11] + b[11] * scale3;
    out[12] = a[12] + b[12] * scale3;
    out[13] = a[13] + b[13] * scale3;
    out[14] = a[14] + b[14] * scale3;
    out[15] = a[15] + b[15] * scale3;
    return out;
  }
  function exactEquals(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7] && a[8] === b[8] && a[9] === b[9] && a[10] === b[10] && a[11] === b[11] && a[12] === b[12] && a[13] === b[13] && a[14] === b[14] && a[15] === b[15];
  }
  function equals(a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
    var a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7];
    var a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11];
    var a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    var b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7];
    var b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11];
    var b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15];
    return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2)) && Math.abs(a3 - b3) <= EPSILON * Math.max(1, Math.abs(a3), Math.abs(b3)) && Math.abs(a4 - b4) <= EPSILON * Math.max(1, Math.abs(a4), Math.abs(b4)) && Math.abs(a5 - b5) <= EPSILON * Math.max(1, Math.abs(a5), Math.abs(b5)) && Math.abs(a6 - b6) <= EPSILON * Math.max(1, Math.abs(a6), Math.abs(b6)) && Math.abs(a7 - b7) <= EPSILON * Math.max(1, Math.abs(a7), Math.abs(b7)) && Math.abs(a8 - b8) <= EPSILON * Math.max(1, Math.abs(a8), Math.abs(b8)) && Math.abs(a9 - b9) <= EPSILON * Math.max(1, Math.abs(a9), Math.abs(b9)) && Math.abs(a10 - b10) <= EPSILON * Math.max(1, Math.abs(a10), Math.abs(b10)) && Math.abs(a11 - b11) <= EPSILON * Math.max(1, Math.abs(a11), Math.abs(b11)) && Math.abs(a12 - b12) <= EPSILON * Math.max(1, Math.abs(a12), Math.abs(b12)) && Math.abs(a13 - b13) <= EPSILON * Math.max(1, Math.abs(a13), Math.abs(b13)) && Math.abs(a14 - b14) <= EPSILON * Math.max(1, Math.abs(a14), Math.abs(b14)) && Math.abs(a15 - b15) <= EPSILON * Math.max(1, Math.abs(a15), Math.abs(b15));
  }
  var mul = multiply;
  var sub = subtract;

  // node_modules/gl-matrix/esm/vec3.js
  var vec3_exports = {};
  __export(vec3_exports, {
    add: () => add2,
    angle: () => angle,
    bezier: () => bezier,
    ceil: () => ceil,
    clone: () => clone2,
    copy: () => copy2,
    create: () => create2,
    cross: () => cross,
    dist: () => dist,
    distance: () => distance,
    div: () => div,
    divide: () => divide,
    dot: () => dot,
    equals: () => equals2,
    exactEquals: () => exactEquals2,
    floor: () => floor,
    forEach: () => forEach,
    fromValues: () => fromValues2,
    hermite: () => hermite,
    inverse: () => inverse,
    len: () => len,
    length: () => length,
    lerp: () => lerp,
    max: () => max,
    min: () => min,
    mul: () => mul2,
    multiply: () => multiply2,
    negate: () => negate,
    normalize: () => normalize,
    random: () => random,
    rotateX: () => rotateX2,
    rotateY: () => rotateY2,
    rotateZ: () => rotateZ2,
    round: () => round2,
    scale: () => scale2,
    scaleAndAdd: () => scaleAndAdd,
    set: () => set2,
    slerp: () => slerp,
    sqrDist: () => sqrDist,
    sqrLen: () => sqrLen,
    squaredDistance: () => squaredDistance,
    squaredLength: () => squaredLength,
    str: () => str2,
    sub: () => sub2,
    subtract: () => subtract2,
    transformMat3: () => transformMat3,
    transformMat4: () => transformMat4,
    transformQuat: () => transformQuat,
    zero: () => zero
  });
  function create2() {
    var out = new ARRAY_TYPE(3);
    if (ARRAY_TYPE != Float32Array) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
    }
    return out;
  }
  function clone2(a) {
    var out = new ARRAY_TYPE(3);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
  }
  function length(a) {
    var x = a[0];
    var y = a[1];
    var z = a[2];
    return Math.sqrt(x * x + y * y + z * z);
  }
  function fromValues2(x, y, z) {
    var out = new ARRAY_TYPE(3);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  }
  function copy2(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
  }
  function set2(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  }
  function add2(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
  }
  function subtract2(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
  }
  function multiply2(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    return out;
  }
  function divide(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    return out;
  }
  function ceil(out, a) {
    out[0] = Math.ceil(a[0]);
    out[1] = Math.ceil(a[1]);
    out[2] = Math.ceil(a[2]);
    return out;
  }
  function floor(out, a) {
    out[0] = Math.floor(a[0]);
    out[1] = Math.floor(a[1]);
    out[2] = Math.floor(a[2]);
    return out;
  }
  function min(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    return out;
  }
  function max(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    return out;
  }
  function round2(out, a) {
    out[0] = round(a[0]);
    out[1] = round(a[1]);
    out[2] = round(a[2]);
    return out;
  }
  function scale2(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    return out;
  }
  function scaleAndAdd(out, a, b, scale3) {
    out[0] = a[0] + b[0] * scale3;
    out[1] = a[1] + b[1] * scale3;
    out[2] = a[2] + b[2] * scale3;
    return out;
  }
  function distance(a, b) {
    var x = b[0] - a[0];
    var y = b[1] - a[1];
    var z = b[2] - a[2];
    return Math.sqrt(x * x + y * y + z * z);
  }
  function squaredDistance(a, b) {
    var x = b[0] - a[0];
    var y = b[1] - a[1];
    var z = b[2] - a[2];
    return x * x + y * y + z * z;
  }
  function squaredLength(a) {
    var x = a[0];
    var y = a[1];
    var z = a[2];
    return x * x + y * y + z * z;
  }
  function negate(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    return out;
  }
  function inverse(out, a) {
    out[0] = 1 / a[0];
    out[1] = 1 / a[1];
    out[2] = 1 / a[2];
    return out;
  }
  function normalize(out, a) {
    var x = a[0];
    var y = a[1];
    var z = a[2];
    var len2 = x * x + y * y + z * z;
    if (len2 > 0) {
      len2 = 1 / Math.sqrt(len2);
    }
    out[0] = a[0] * len2;
    out[1] = a[1] * len2;
    out[2] = a[2] * len2;
    return out;
  }
  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function cross(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2];
    var bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  }
  function lerp(out, a, b, t) {
    var ax = a[0];
    var ay = a[1];
    var az = a[2];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    return out;
  }
  function slerp(out, a, b, t) {
    var angle2 = Math.acos(Math.min(Math.max(dot(a, b), -1), 1));
    var sinTotal = Math.sin(angle2);
    var ratioA = Math.sin((1 - t) * angle2) / sinTotal;
    var ratioB = Math.sin(t * angle2) / sinTotal;
    out[0] = ratioA * a[0] + ratioB * b[0];
    out[1] = ratioA * a[1] + ratioB * b[1];
    out[2] = ratioA * a[2] + ratioB * b[2];
    return out;
  }
  function hermite(out, a, b, c, d, t) {
    var factorTimes2 = t * t;
    var factor1 = factorTimes2 * (2 * t - 3) + 1;
    var factor2 = factorTimes2 * (t - 2) + t;
    var factor3 = factorTimes2 * (t - 1);
    var factor4 = factorTimes2 * (3 - 2 * t);
    out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
    out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
    out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
    return out;
  }
  function bezier(out, a, b, c, d, t) {
    var inverseFactor = 1 - t;
    var inverseFactorTimesTwo = inverseFactor * inverseFactor;
    var factorTimes2 = t * t;
    var factor1 = inverseFactorTimesTwo * inverseFactor;
    var factor2 = 3 * t * inverseFactorTimesTwo;
    var factor3 = 3 * factorTimes2 * inverseFactor;
    var factor4 = factorTimes2 * t;
    out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
    out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
    out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
    return out;
  }
  function random(out, scale3) {
    scale3 = scale3 === void 0 ? 1 : scale3;
    var r = RANDOM() * 2 * Math.PI;
    var z = RANDOM() * 2 - 1;
    var zScale = Math.sqrt(1 - z * z) * scale3;
    out[0] = Math.cos(r) * zScale;
    out[1] = Math.sin(r) * zScale;
    out[2] = z * scale3;
    return out;
  }
  function transformMat4(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    w = w || 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  }
  function transformMat3(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = x * m[0] + y * m[3] + z * m[6];
    out[1] = x * m[1] + y * m[4] + z * m[7];
    out[2] = x * m[2] + y * m[5] + z * m[8];
    return out;
  }
  function transformQuat(out, a, q) {
    var qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    var vx = a[0], vy = a[1], vz = a[2];
    var tx = qy * vz - qz * vy;
    var ty = qz * vx - qx * vz;
    var tz = qx * vy - qy * vx;
    tx = tx + tx;
    ty = ty + ty;
    tz = tz + tz;
    out[0] = vx + qw * tx + qy * tz - qz * ty;
    out[1] = vy + qw * ty + qz * tx - qx * tz;
    out[2] = vz + qw * tz + qx * ty - qy * tx;
    return out;
  }
  function rotateX2(out, a, b, rad) {
    var p = [], r = [];
    p[0] = a[0] - b[0];
    p[1] = a[1] - b[1];
    p[2] = a[2] - b[2];
    r[0] = p[0];
    r[1] = p[1] * Math.cos(rad) - p[2] * Math.sin(rad);
    r[2] = p[1] * Math.sin(rad) + p[2] * Math.cos(rad);
    out[0] = r[0] + b[0];
    out[1] = r[1] + b[1];
    out[2] = r[2] + b[2];
    return out;
  }
  function rotateY2(out, a, b, rad) {
    var p = [], r = [];
    p[0] = a[0] - b[0];
    p[1] = a[1] - b[1];
    p[2] = a[2] - b[2];
    r[0] = p[2] * Math.sin(rad) + p[0] * Math.cos(rad);
    r[1] = p[1];
    r[2] = p[2] * Math.cos(rad) - p[0] * Math.sin(rad);
    out[0] = r[0] + b[0];
    out[1] = r[1] + b[1];
    out[2] = r[2] + b[2];
    return out;
  }
  function rotateZ2(out, a, b, rad) {
    var p = [], r = [];
    p[0] = a[0] - b[0];
    p[1] = a[1] - b[1];
    p[2] = a[2] - b[2];
    r[0] = p[0] * Math.cos(rad) - p[1] * Math.sin(rad);
    r[1] = p[0] * Math.sin(rad) + p[1] * Math.cos(rad);
    r[2] = p[2];
    out[0] = r[0] + b[0];
    out[1] = r[1] + b[1];
    out[2] = r[2] + b[2];
    return out;
  }
  function angle(a, b) {
    var ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2], mag = Math.sqrt((ax * ax + ay * ay + az * az) * (bx * bx + by * by + bz * bz)), cosine = mag && dot(a, b) / mag;
    return Math.acos(Math.min(Math.max(cosine, -1), 1));
  }
  function zero(out) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
  }
  function str2(a) {
    return "vec3(" + a[0] + ", " + a[1] + ", " + a[2] + ")";
  }
  function exactEquals2(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }
  function equals2(a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2];
    var b0 = b[0], b1 = b[1], b2 = b[2];
    return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) && Math.abs(a2 - b2) <= EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2));
  }
  var sub2 = subtract2;
  var mul2 = multiply2;
  var div = divide;
  var dist = distance;
  var sqrDist = squaredDistance;
  var len = length;
  var sqrLen = squaredLength;
  var forEach = function() {
    var vec = create2();
    return function(a, stride, offset, count, fn, arg) {
      var i, l;
      if (!stride) {
        stride = 3;
      }
      if (!offset) {
        offset = 0;
      }
      if (count) {
        l = Math.min(count * stride + offset, a.length);
      } else {
        l = a.length;
      }
      for (i = offset; i < l; i += stride) {
        vec[0] = a[i];
        vec[1] = a[i + 1];
        vec[2] = a[i + 2];
        fn(vec, vec, arg);
        a[i] = vec[0];
        a[i + 1] = vec[1];
        a[i + 2] = vec[2];
      }
      return a;
    };
  }();

  // src/engine/render/pipelines/voxel/class.ts
  var query = defineQuery([Transform, Renderable]);
  function createModelMatrix(x, y, z) {
    const out = mat4_exports.create();
    mat4_exports.translate(out, out, [x, y, z]);
    return out;
  }
  var VoxelPipeline = class extends Pipeline {
    constructor(device, width, height) {
      super(device, width, height, "rgba16float");
    }
    tick(delta, passEncoder) {
      const { device, meshManager, camera } = renderData;
      const entities = query(world);
      const pipeline = this.getPass(0)?.getPipeline();
      if (!pipeline) {
        console.log("No pipeline found operation aborted");
        return;
      }
      if (!camera) {
        console.log("No camera found operation aborted");
        return;
      }
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, this.bindGroup);
      const viewProjMatrix = camera.viewProjMatrix;
      const globalUniformData = new Float32Array(24);
      globalUniformData.set(camera.viewProjMatrix, 0);
      globalUniformData[16] = camera.position[0];
      globalUniformData[17] = camera.position[1];
      globalUniformData[18] = camera.position[2];
      if (!this.totalTime) this.totalTime = 0;
      this.totalTime += delta;
      globalUniformData[19] = this.totalTime;
      globalUniformData[23] = 0;
      device.queue.writeBuffer(
        this.globalUniformBuffer,
        0,
        globalUniformData.buffer,
        globalUniformData.byteOffset,
        globalUniformData.byteLength
      );
      for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        const uniformBuffer = uniformBuffers.get(eid);
        const bindGroup = bindGroups.get(eid);
        if (!uniformBuffer || !bindGroup) {
          console.warn(`Missing GPU resources for entity ${eid}`);
          continue;
        }
        const modelMatrix = createModelMatrix(
          Transform.x[eid],
          Transform.y[eid],
          Transform.z[eid]
        );
        const objectUniformData = new ArrayBuffer(80);
        const f32View = new Float32Array(objectUniformData);
        const u32View = new Uint32Array(objectUniformData);
        f32View.set(modelMatrix, 0);
        u32View[16] = GlowyEdge.mask[eid];
        this.device.queue.writeBuffer(
          uniformBuffer,
          0,
          objectUniformData
        );
        const mesh = meshManager.getMesh(Renderable.meshId[eid]);
        if (!mesh) {
          console.log("No mesh found operation aborted");
          continue;
        }
        passEncoder.setBindGroup(1, bindGroup);
        passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
        passEncoder.setIndexBuffer(mesh.indexBuffer, "uint16");
        passEncoder.drawIndexed(mesh.indexCount, 585);
      }
    }
  };

  // src/engine/render/pipelines/index.ts
  var voxelPipeline;
  var postPipeline;
  async function initialize() {
    const { device, context } = renderData;
    {
      const w = renderData.canvas.width | 0;
      const h = renderData.canvas.height | 0;
      voxelPipeline = new VoxelPipeline(device, w, h);
      const res = await fetch("dist/shaders/voxel/voxel.wgsl");
      const code = await res.text();
      voxelPipeline.addPass(0 /* MAIN */, code, code, "rgba16float");
      voxelPipeline.globalUniformBuffer = device.createBuffer({
        size: 96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const bindGroupLayout = voxelPipeline.getPass(0).getPipeline().getBindGroupLayout(0);
      voxelPipeline.bindGroup = voxelPipeline.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: voxelPipeline.globalUniformBuffer
            }
          }
        ]
      });
      voxelPipeline.modelUniformBuffer = device.createBuffer({
        size: 80,
        // 4x4 matrix
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const modelBindGroupLayout = voxelPipeline.getPass(0).getPipeline().getBindGroupLayout(1);
      voxelPipeline.modelBindGroup = device.createBindGroup({
        layout: modelBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: voxelPipeline.modelUniformBuffer
            }
          }
        ]
      });
    }
    {
      const postRes = await fetch("dist/shaders/post/post.wgsl");
      const postCode = await postRes.text();
      postPipeline = new PostPipeline(device, postCode);
    }
  }
  function tick(delta) {
    const { device, context } = renderData;
    renderData.camera?.update(delta);
    if (!device || !context) return;
    const commandEncoder = device.createCommandEncoder();
    const sceneColorView = voxelPipeline.getColorTextureView();
    const scenePass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: sceneColorView,
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }],
      depthStencilAttachment: {
        view: voxelPipeline.getDepthTextureView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      }
    });
    voxelPipeline.tick(delta, scenePass);
    scenePass.end();
    const swapView = context.getCurrentTexture().createView();
    postPipeline.encode(commandEncoder, sceneColorView, swapView);
    device.queue.submit([commandEncoder.finish()]);
  }

  // src/engine/render/classes/mesh.ts
  var MeshManager = class {
    constructor(device) {
      this.device = device;
      this.meshes = /* @__PURE__ */ new Map();
      this.nextId = 1;
    }
    registerMesh(mesh) {
      const id = this.nextId++;
      this.meshes.set(id, mesh);
      return id;
    }
    getMesh(id) {
      return this.meshes.get(id);
    }
  };

  // src/game/camera.ts
  var Camera = class {
    constructor(fov, aspect) {
      this.viewProjMatrix = mat4_exports.create();
      this.forward = vec3_exports.create();
      this.position = vec3_exports.fromValues(5, 5, 5);
      this.yaw = 0;
      this.pitch = 0;
      this.up = vec3_exports.fromValues(0, 1, 0);
      this.near = 1;
      this.far = 100;
      this.speed = 5;
      // units per second
      this.sprintMultiplier = 2.5;
      this.sensitivity = 2e-3;
      // Input state
      this.keysPressed = /* @__PURE__ */ new Set();
      this.dragging = false;
      this.lastX = 0;
      this.lastY = 0;
      this.fov = fov;
      this.aspect = aspect;
      this.initInputListeners();
    }
    initInputListeners() {
      const { canvas } = renderData;
      window.addEventListener("keydown", (e) => {
        this.keysPressed.add(e.key.toLowerCase());
      });
      window.addEventListener("keyup", (e) => {
        this.keysPressed.delete(e.key.toLowerCase());
      });
      canvas.addEventListener("mousedown", (e) => {
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        canvas.requestPointerLock?.();
      });
      window.addEventListener("mouseup", () => {
        this.dragging = false;
        document.exitPointerLock?.();
      });
      window.addEventListener("mousemove", (e) => {
        if (!this.dragging) return;
        const deltaX = e.movementX ?? e.clientX - this.lastX;
        const deltaY = e.movementY ?? e.clientY - this.lastY;
        this.rotate(
          -deltaX * this.sensitivity,
          -deltaY * this.sensitivity
        );
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      });
    }
    update(deltaTime) {
      this.aspect = renderData.canvas.width / renderData.canvas.height;
      let velocity = this.speed * deltaTime;
      const forward = vec3_exports.fromValues(
        Math.cos(this.pitch) * Math.sin(this.yaw),
        Math.sin(this.pitch),
        Math.cos(this.pitch) * Math.cos(this.yaw)
      );
      vec3_exports.normalize(forward, forward);
      vec3_exports.copy(this.forward, forward);
      const right = vec3_exports.fromValues(
        Math.sin(this.yaw - Math.PI / 2),
        0,
        Math.cos(this.yaw - Math.PI / 2)
      );
      vec3_exports.normalize(right, right);
      if (this.keysPressed.has("shift")) {
        velocity *= this.sprintMultiplier;
      }
      if (this.keysPressed.has("w")) {
        vec3_exports.scaleAndAdd(
          this.position,
          this.position,
          forward,
          velocity
        );
      }
      if (this.keysPressed.has("s")) {
        vec3_exports.scaleAndAdd(
          this.position,
          this.position,
          forward,
          -velocity
        );
      }
      if (this.keysPressed.has("d")) {
        vec3_exports.scaleAndAdd(this.position, this.position, right, velocity);
      }
      if (this.keysPressed.has("a")) {
        vec3_exports.scaleAndAdd(this.position, this.position, right, -velocity);
      }
      const target = vec3_exports.create();
      vec3_exports.add(target, this.position, forward);
      const view = mat4_exports.lookAt(
        mat4_exports.create(),
        this.position,
        target,
        this.up
      );
      const proj = mat4_exports.perspective(
        mat4_exports.create(),
        this.fov * Math.PI / 180,
        this.aspect,
        this.near,
        this.far
      );
      mat4_exports.multiply(this.viewProjMatrix, proj, view);
    }
    rotate(yawOffset, pitchOffset) {
      this.yaw += yawOffset;
      this.pitch += pitchOffset;
      const maxPitch = Math.PI / 2 * 0.99;
      this.pitch = Math.min(maxPitch, Math.max(-maxPitch, this.pitch));
    }
  };

  // src/engine/render/init.ts
  async function init() {
    if (!navigator.gpu) {
      console.error("WebGPU not supported.");
      return;
    }
    renderData.canvas = document.getElementById("webgpu-canvas");
    renderData.adapter = await navigator.gpu.requestAdapter();
    renderData.device = await renderData.adapter?.requestDevice();
    renderData.context = renderData.canvas.getContext("webgpu");
    renderData.format = navigator.gpu.getPreferredCanvasFormat();
    renderData.context.configure({
      device: renderData.device,
      format: renderData.format,
      alphaMode: "opaque"
    });
    renderData.camera = new Camera(45, renderData.canvas.width / renderData.canvas.height);
    renderData.meshManager = new MeshManager(render.device);
    await initialize();
    let id = renderData.meshManager?.registerMesh(createMesh(renderData.device));
    if (id == void 0) {
      console.log(`[render.ts::init] - Failed to generate cube mesh`);
      return;
    }
    const modelBindGroupLayout = voxelPipeline.getPass(0).getPipeline().getBindGroupLayout(1);
    initializeWorld(id, modelBindGroupLayout);
  }

  // src/engine/render/tick.ts
  function tick2(delta) {
    const { device, context } = renderData;
    if (!device || !context) return;
    tick(delta);
  }

  // src/engine/render/index.ts
  var render = {
    init,
    tick: tick2,
    get device() {
      return renderData.device;
    },
    get context() {
      return renderData.context;
    },
    get format() {
      return renderData.format;
    }
  };

  // src/index.ts
  async function main() {
    await render.init();
    requestAnimationFrame(loop);
  }
  var lastTime = 0;
  function loop(time) {
    const delta = (time - lastTime) / 1e3;
    lastTime = time;
    render.tick(delta);
    const fps = 1 / delta;
    document.title = `FPS: ${fps.toFixed(1)}`;
    requestAnimationFrame(loop);
  }
  main();
})();
//! HARDCODED mesh ID
