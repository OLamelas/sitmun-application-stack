import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { APP_ID, TERRITORY_ID, ROLE_ID, generateViewerPassword, uniqueViewerUsername } from './fixtures';

const headers = { 'X-SITMUN-Client': 'admin', 'Content-Type': 'application/json' };
const uri = (resource: string, id: number) => `http://localhost:18080/api/${resource}/${id}`;
const profilePath = `/backend/api/config/client/profile/${APP_ID}/${TERRITORY_ID}`;

async function create(api: APIRequestContext, collection: string, data: object): Promise<number> {
  const response = await api.post(`/backend/api/${collection}`, { headers, data });
  expect(response.status(), `${collection}: ${await response.text()}`).toBe(201);
  const match = response.headers().location?.match(/\/(\d+)$/);
  expect(match, `Missing ${collection} location`).toBeTruthy(); return Number(match![1]);
}

async function login(page: Page, username: string, password: string) {
  await page.goto('/auth/login');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form .login-button button').click();
  await expect(page).toHaveURL(/\/user\/dashboard/);
  await page.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`);
  await page.waitForFunction(() => {
    const w = window as any; const host = document.querySelector('.tc-map');
    return host && w.TC?.Map?.get(host)?.controls?.some((c: any) => c.CLASS === 'tc-ctl-wfsedit');
  });
}

async function attachLayer(page: Page, cartographyId: number, serviceId: number, id = 'edition-fixture') {
  await page.evaluate(async ({ cartographyId, serviceId, id }) => {
    const w = window as any; const map = w.TC.Map.get(document.querySelector('.tc-map'));
    await map.addLayer({ id, title: 'Edition fixture', type: 'WFS',
      url: `${location.origin}/middleware/proxy/1/1/WFS/${serviceId}/${cartographyId}`,
      featureType: ['app:roads'], featureNS: 'urn:sitmun:e2e:edition', featurePrefix: 'app',
      outputFormat: 'application/json', geometryName: 'geom', profileLayerId: `layer/${cartographyId}` });
  }, { cartographyId, serviceId, id });
  await expect.poll(() => page.evaluate(id => {
    const w = window as any; const map = w.TC.Map.get(document.querySelector('.tc-map'));
    return map.getLayer(id).features.length;
  }, id)).toBeGreaterThan(0);
}

async function exerciseDirectClose(page: Page) {
  let release!: () => void; let reached!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { reached = resolve; });
  const pattern = `**${profilePath}**`;
  await page.evaluate(async () => {
    const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
    await c.closeEditSession();
    if (c.sitmunCanMutate()) throw new Error('Direct close retained permission');
  });
  await page.route(pattern, async route => { reached(); await ready; await route.continue(); });
  try {
    await page.evaluate(() => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      w.pendingOpening = c.openEditSession();
    });
    await entered;
    await page.evaluate(async () => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      await c.closeEditSession();
    });
  } finally { release(); }
  await page.evaluate(async () => { await (window as any).pendingOpening; });
  await page.unroute(pattern);
  expect(await page.evaluate(() => {
    const w = window as any; return w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit').sitmunCanMutate();
  })).toBe(false);
  let refreshes = 0;
  const count = (request: any) => { if (request.url().includes(profilePath)) refreshes++; };
  page.on('request', count);
  try {
    await page.evaluate(async () => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      await c.openEditSession(); if (!c.sitmunCanMutate()) throw new Error('Fresh reopening failed');
    });
    expect(refreshes).toBeGreaterThan(0);
  } finally { page.off('request', count); }

  // Stop the actual native open at its schema await, not at an arbitrary delay.
  await page.evaluate(async () => {
    const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
    await c.closeEditSession();
    const layer = c.layer; const original = layer.describeFeatureType;
    const ready = new Promise<void>(resolve => { w.releaseSchema = resolve; });
    layer.describeFeatureType = async function (...args: any[]) { w.schemaEntered = true; await ready; return original.apply(this, args); };
    w.restoreSchema = () => { layer.describeFeatureType = original; };
    w.pendingOpening = c.openEditSession();
  });
  await page.waitForFunction(() => (window as any).schemaEntered);
  const late = await page.evaluate(async () => {
    const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
    await c.closeEditSession(); w.releaseSchema(); await w.pendingOpening; w.restoreSchema();
    c.editControl.activate(); c.editControl.mode = 'addpoint';
    return c.sitmunCanMutate();
  });
  expect(late).toBe(false);
  await page.evaluate(async () => {
    const w = window as any; await w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit').openEditSession();
  });
}

async function exerciseLayerTransition(page: Page, cartographyId: number, serviceId: number) {
  await attachLayer(page, cartographyId, serviceId, 'edition-fixture-b');
  const positive = await page.evaluate(async () => {
    const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
    await c.sitmunChangeEditingLayer('edition-fixture-b');
    const result = { layer: c.layer?.id, allowed: c.sitmunCanMutate() };
    await c.sitmunChangeEditingLayer('edition-fixture'); return result;
  });
  expect(positive).toEqual({ layer: 'edition-fixture-b', allowed: true });
  await page.evaluate(() => {
    const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
    const original = c.sitmunCloseLayerTransition;
    const ready = new Promise<void>(resolve => { w.releaseTransition = resolve; });
    c.sitmunCloseLayerTransition = async (...args: any[]) => {
      await original(...args); w.transitionEntered = true; await ready;
    };
    w.restoreTransition = () => { c.sitmunCloseLayerTransition = original; };
    w.pendingTransition = c.sitmunChangeEditingLayer('edition-fixture-b');
  });
  await page.waitForFunction(() => (window as any).transitionEntered);
  expect(await page.evaluate(async () => {
    const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
    if (c.sitmunCanMutate()) throw new Error('Old layer mutable during transition');
    await c.closeEditSession(); w.releaseTransition(); await w.pendingTransition; w.restoreTransition();
    return { layer: c.layer?.id, allowed: c.sitmunCanMutate() };
  })).toEqual({ layer: 'edition-fixture', allowed: false });
  await page.evaluate(async () => {
    const w = window as any; await w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit').openEditSession();
  });
}

async function exerciseRealDraftLock(page: Page, cartographyId: number, serviceId: number) {
  const other = await page.context().newPage();
  const legacy = `SITNA.offline.edit.app:roads@https://synthetic.test/wfs-${Date.now()}`;
  try {
    await other.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`);
    await other.waitForFunction(() => {
      const w = window as any; const host = document.querySelector('.tc-map');
      return host && w.TC?.Map?.get(host)?.controls?.some((c: any) => c.CLASS === 'tc-ctl-wfsedit');
    });
    await attachLayer(page, cartographyId, serviceId, 'edition-race');
    await attachLayer(other, cartographyId, serviceId, 'edition-race');
    await page.evaluate(async legacy => {
      const w = window as any;
      await w.draftStore.setItem(legacy + '.modified.roads.1', { value: 'isolated-race' });
      w.heldLock = navigator.locks.request(`sitmun-wfs-legacy:${legacy}`, async () => {
        w.lockEntered = true; await new Promise<void>(resolve => { w.releaseDraftLock = resolve; });
      });
    }, legacy);
    await page.waitForFunction(() => (window as any).lockEntered);
    for (const [index, tab] of [page, other].entries()) {
      await tab.evaluate(({ legacy, index }) => {
        const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
        const migrate = c.sitmunMigrateLegacyDrafts;
        c.sitmunMigrateLegacyDrafts = async (store: any) => {
          c.sitmunMigrateLegacyDrafts = migrate;
          return migrate(store, legacy, `${legacy}.scope-${index}`);
        };
        w.raceOpening = c.setLayer('edition-race');
      }, { legacy, index });
    }
    // Both actual browser lock requests must be queued before releasing either.
    await page.waitForFunction(async legacy => {
      const state = await navigator.locks.query();
      return state.pending?.filter(lock => lock.name === `sitmun-wfs-legacy:${legacy}`).length === 2;
    }, legacy);
    await page.evaluate(async () => { const w = window as any; w.releaseDraftLock(); await w.heldLock; });
    await Promise.all([page, other].map(tab => tab.evaluate(async () => { await (window as any).raceOpening; })));
    const result = await page.evaluate(async legacy => {
      const store = (window as any).draftStore;
      const claim = await store.getItem(`sitmun-wfs-legacy-owner:${legacy}`);
      const copies = await Promise.all([0, 1].map(index => store.getItem(`${legacy}.scope-${index}.modified.roads.1`)));
      return { complete: claim.complete, owner: claim.owner, copies: copies.filter(Boolean).length,
        original: await store.getItem(legacy + '.modified.roads.1') };
    }, legacy);
    expect(result).toEqual({ complete: true, owner: expect.stringMatching(/\.scope-[01]$/), copies: 1, original: { value: 'isolated-race' } });
    await page.evaluate(async () => {
      const w = window as any; await w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit').sitmunChangeEditingLayer('edition-fixture');
    });
  } finally {
    await page.evaluate(() => { (window as any).releaseDraftLock?.(); });
    await other.close();
  }
}

test('real task policy: read-only user, native preflight, authorized save and revoked local changes', async ({ browser, playwright }) => {
  const admin = await playwright.request.newContext({ baseURL: 'http://localhost:4400' });
  const viewerContext = await browser.newContext({ baseURL: 'http://localhost:4400', serviceWorkers: 'allow' });
  const editorContext = await browser.newContext({ baseURL: 'http://localhost:4400', serviceWorkers: 'allow' });
  try {
    expect((await admin.post('/backend/api/authenticate/admin', { data: { username: 'admin', password: 'admin' } })).ok()).toBeTruthy();
    const suffix = String(Date.now());
    const editRole = await create(admin, 'roles', { name: `wfs-editor-${suffix}`, applications: [uri('applications', APP_ID)] });
    const credentials = [];
    for (const writer of [false, true]) {
      const username = uniqueViewerUsername(); const password = generateViewerPassword();
      const id = await create(admin, 'users', { username, password, firstName: 'WFS', lastName: 'Fixture',
        email: `${username}@example.test`, administrator: false, blocked: false });
      for (const role of writer ? [ROLE_ID, editRole] : [ROLE_ID]) await create(admin, 'user-configurations', {
        user: uri('users', id), territory: uri('territories', TERRITORY_ID), role: uri('roles', role), appliesToChildrenTerritories: false
      });
      credentials.push({ username, password });
    }
    const serviceId = await create(admin, 'services', { name: `wfs-${suffix}`, type: 'WFS',
      serviceURL: 'http://127.0.0.1:18093/wfs-edit', isProxied: true, blocked: false });
    const cartographyId = await create(admin, 'cartographies', { name: `wfs-${suffix}`, service: uri('services', serviceId),
      layers: ['app:roads'], blocked: false, queryableFeatureAvailable: false, queryableFeatureEnabled: false, useAllStyles: false });
    await create(admin, 'cartography-availabilities', { cartography: uri('cartographies', cartographyId), territory: uri('territories', TERRITORY_ID) });
    const permission = await create(admin, 'cartography-groups', { name: `wfs-${suffix}`, roles: [uri('roles', ROLE_ID)], members: [uri('cartographies', cartographyId)] });
    expect(permission).toBeGreaterThan(0);
    // A tree reference retains the readable layer for BOTH users, independently of edition tasks.
    const parentTree = await admin.get('/backend/api/tree-nodes/5/tree', { headers });
    expect(parentTree.ok()).toBeTruthy(); const treeId = (await parentTree.json()).id;
    await create(admin, 'tree-nodes', { name: `wfs-${suffix}`, tree: uri('trees', treeId), parent: uri('tree-nodes', 5),
      cartography: uri('cartographies', cartographyId), visible: true, active: false, order: 99 });
    const uis = await admin.get('/backend/api/task-uis?size=200', { headers });
    expect(uis.ok()).toBeTruthy();
    const ui = Object.values((await uis.json())._embedded).flat().find((row: any) => row.name === 'sitna.WFSEdit') as any;
    expect(ui?.id).toBeTruthy();
    for (const [type, roles, cartography] of [[1, [ROLE_ID], undefined], [0, [editRole], cartographyId]] as const) {
      const id = await create(admin, 'tasks', { name: `wfs-task-${type}-${suffix}`, type: uri('task-types', type),
        ...(type === 1 ? { ui: uri('task-uis', ui.id) } : { properties: { scope: 'feat-edit' }, cartography: uri('cartographies', cartography!) }),
        roles: roles.map(role => uri('roles', role)) });
      await create(admin, 'task-availabilities', { task: uri('tasks', id), territory: uri('territories', TERRITORY_ID) });
      if (type === 0) test.info().annotations.push({ type: 'edition-task', description: String(id) });
    }
    const read = await viewerContext.newPage(); const write = await editorContext.newPage();
    await login(read, credentials[0].username, credentials[0].password);
    await login(write, credentials[1].username, credentials[1].password);
    const [readProfile, writeProfile] = await Promise.all([read.request.get(profilePath), write.request.get(profilePath)]);
    expect(readProfile.ok()).toBeTruthy(); expect(writeProfile.ok()).toBeTruthy();
    const rp = await readProfile.json(); const wp = await writeProfile.json();
    expect(rp.tasks.some((t: any) => t['ui-control'] === 'sitna.WFSEdit')).toBe(true);
    expect(rp.layers.some((l: any) => l.id === `layer/${cartographyId}`)).toBe(true);
    expect(rp.tasks.some((t: any) => t.scope === 'feat-edit' && t.layer === `layer/${cartographyId}`)).toBe(false);
    const edition = wp.tasks.find((t: any) => t.scope === 'feat-edit' && t.layer === `layer/${cartographyId}`);
    expect(edition?.url).toBeTruthy();
    await attachLayer(read, cartographyId, serviceId); await attachLayer(write, cartographyId, serviceId);
    // Seed only this fresh browser context through the actual native storage adapter.
    await write.evaluate(() => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      const migrate = c.sitmunMigrateLegacyDrafts;
      c.sitmunMigrateLegacyDrafts = async (store: any, legacy: string, scoped: string, alternate?: string) => {
        c.sitmunMigrateLegacyDrafts = migrate; w.draftStore = store;
        const data = { id: 'roads.1', geometry: [422500, 4608500], type: 'point', attributes: { name: 'synthetic-recovered' } };
        w.draftKeys = { own: legacy + '.modified.roads.1', foreign: legacy + '0.modified.roads.1', unknown: scoped + '.unknown.roads.1', scoped: scoped + '.modified.roads.1', legacy, prefix: scoped };
        for (const key of [w.draftKeys.own, w.draftKeys.foreign, w.draftKeys.unknown]) await store.setItem(key, data);
        return migrate(store, legacy, scoped, alternate);
      };
    });
    const denied = await read.evaluate(async () => {
      const w = window as any; const map = w.TC.Map.get(document.querySelector('.tc-map'));
      const control = map.controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      const layer = map.getLayer('edition-fixture');
      const before = JSON.stringify(layer.features.map((f: any) => [f.id, f.geometry, f.getData()]));
      const result = await control.setLayer(layer); await control.openEditSession();
      return { result: result?.id ?? null, selected: control.layer?.id ?? null, mode: control.editControl.mode || null,
        unchanged: before === JSON.stringify(layer.features.map((f: any) => [f.id, f.geometry, f.getData()])),
        sessions: Object.keys(control.layersEditData ?? {}).length, helper: !!layer.wfsLayer };
    });
    expect(denied).toEqual({ result: null, selected: null, mode: null, unchanged: true, sessions: 0, helper: false });
    const xml = '<w:Transaction xmlns:w="http://www.opengis.net/wfs" xmlns:p="urn:sitmun:e2e:edition"><w:Update typeName="p:roads"><w:Property><w:Name>p:name</w:Name><w:Value>authorized</w:Value></w:Property><ogc:Filter xmlns:ogc="http://www.opengis.net/ogc"><ogc:FeatureId fid="roads.1"/></ogc:Filter></w:Update></w:Transaction>';
    const proxy = `/middleware/proxy/${APP_ID}/${TERRITORY_ID}/WFS/${serviceId}/${cartographyId}`;
    const stats = async () => (await admin.get('http://127.0.0.1:18093/wfs-edit-stats')).json();
    const before = await stats();
    const readToken = (await (await read.request.post('/backend/api/authenticate/proxy')).json()).proxy_token;
    const direct = await read.request.post(proxy, { headers: { Authorization: `Bearer ${readToken}`, 'Content-Type': 'application/xml' }, data: xml });
    expect(direct.status()).toBe(403); expect((await stats()).transactions).toBe(before.transactions);
    expect((await stats()).metadata).toBe(before.metadata);
    // Native opening and history registration, followed by the existing native transport.
    await write.evaluate(async () => {
      const w = window as any; const map = w.TC.Map.get(document.querySelector('.tc-map'));
      const control = map.controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      await control.sitmunChangeEditingLayer('edition-fixture');
    });
    await expect.poll(() => write.evaluate(() => {
      const w = window as any; const map = w.TC.Map.get(document.querySelector('.tc-map'));
      return map.getLayer('edition-fixture').features.length;
    })).toBeGreaterThan(0);
    expect(await write.evaluate(async () => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      const { draftKeys: k, draftStore: store } = w;
      return { name: c.editControl.layer.features[0].getData().name,
        scoped: !!await store.getItem(k.scoped), original: !!await store.getItem(k.own),
        foreign: !!await store.getItem(k.foreign), unknown: !!await store.getItem(k.unknown),
        badCopy: !!await store.getItem(k.prefix + '0.modified.roads.1'),
        claim: await store.getItem('sitmun-wfs-legacy-owner:' + k.legacy) };
    })).toEqual({ name: 'synthetic-recovered', scoped: true, original: true, foreign: true, unknown: true,
      badCopy: false, claim: expect.objectContaining({ complete: true }) });
    const change = (page: Page, value: string) => page.evaluate(async value => {
      const w = window as any; const map = w.TC.Map.get(document.querySelector('.tc-map'));
      const control = map.controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      const feature = control.editControl.layer.features[0];
      const action = control.editControl.history.setData(feature, { ...feature.getData(), name: value });
      let registration: Promise<unknown> | undefined;
      control.editControl.trigger('featuremodify.tc', { feature, layer: feature.layer, geometryChanged: false,
        oldData: action.oldData, newData: action.newData,
        sitmunRegister: (operation: Promise<unknown>) => { registration = operation; } });
      if (!registration) throw new Error('Native attribute registration unavailable');
      await registration;
    }, value);
    await change(write, 'native-save');
    await expect.poll(() => write.evaluate(() => {
      const w = window as any; const control = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      return control.getLayerEditData()?.modifiedFeaturesLayer?.features.length;
    })).toBe(1);
    await write.evaluate(async () => {
      const w = window as any; const control = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      await control.applyEdits();
    });
    await expect.poll(async () => (await stats()).transactions).toBe(before.transactions + 1);
    expect((await stats()).name).toBe('native-save');
    await expect.poll(() => write.evaluate(() => {
      const w = window as any; const control = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      return !control.isSyncing && control.getLayerEditData()?.modifiedFeaturesLayer?.features.length === 0;
    })).toBe(true);
    const reread = await write.request.get(proxy + '?service=WFS&request=GetFeature&typename=app:roads&outputFormat=application/json',
      { headers: { Authorization: `Bearer ${(await (await write.request.post('/backend/api/authenticate/proxy')).json()).proxy_token}` } });
    expect(reread.ok()).toBeTruthy(); expect((await reread.json()).features[0].properties.name).toBe('native-save');
    await exerciseDirectClose(write);
    await exerciseLayerTransition(write, cartographyId, serviceId);
    await exerciseRealDraftLock(write, cartographyId, serviceId);
    const imported = await write.evaluate(async () => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      const edit = c.editControl; const feature = edit.layer.features[0].clone();
      feature.setData({ name: 'imported', extra: 'must-not-survive-native-transform' });
      let events = 0; const listener = () => { events++; };
      edit.on('featureadd.tc', listener);
      edit.importFeatures([feature]);
      edit.off('featureadd.tc', listener);
      return { events };
    });
    expect(imported.events).toBe(1);
    await expect.poll(() => write.evaluate(() => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      return c.editControl.layer.features.length;
    })).toBe(2);
    const attributes = await write.evaluate(() => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      return c.editControl.layer.features.find((f: any) => f.getData().name === 'imported')?.getData();
    });
    expect(attributes).toMatchObject({ name: 'imported' }); expect(attributes.extra).toBeUndefined();
    // Discard only the positive import just created by this isolated test.
    await write.evaluate(() => {
      const w = window as any; w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit').discardEdits();
    });
    await expect.poll(() => write.evaluate(() => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      return [c.getLayerEditData().addedFeaturesLayer.features.length, c.editControl.layer.features.length];
    })).toEqual([0, 1]);
    await write.evaluate(async () => {
      const w = window as any; const control = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      await control.openEditSession();
    });
    await change(write, 'preserved-after-revocation');
    await write.evaluate(() => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      c.editControl.showFeatureImportPanel();
    });
    await expect(write.locator('.tc-ctl-edit-import-btn-ok')).toBeVisible();
    await write.evaluate(() => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      c.editControl.featuresToImport = [c.editControl.layer.features[0].clone()];
    });
    const writeToken = (await (await write.request.post('/backend/api/authenticate/proxy')).json()).proxy_token;
    const revoke = await admin.put(`/backend/api/tasks/${edition.id.split('/').pop()}/roles`, {
      headers: { 'X-SITMUN-Client': 'admin', 'Content-Type': 'text/uri-list' }, data: ''
    });
    expect(revoke.ok()).toBeTruthy();
    const preserved = await write.evaluate(async () => {
      const w = window as any; const control = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      await control.applyEdits();
      return { allowed: control.sitmunCanMutate(), pending: control.getLayerEditData().modifiedFeaturesLayer.features.length,
        name: control.editControl.layer.features[0].getData().name };
    });
    expect(preserved).toEqual({ allowed: false, pending: 1, name: 'preserved-after-revocation' });
    const blockedImport = await write.evaluate(async () => {
      const w = window as any; const c = w.TC.Map.get(document.querySelector('.tc-map')).controls.find((c: any) => c.CLASS === 'tc-ctl-wfsedit');
      const edit = c.editControl; const store = w.draftStore;
      let historyEvents = 0; const historyListener = () => { historyEvents++; };
      for (const event of ['push', 'undo', 'redo']) edit.history.addEventListener(event, historyListener);
      const snapshot = async () => JSON.stringify({ features: edit.layer.features.map((f: any) => [f.id, f.geometry, f.getData()]),
        historyEvents, drafts: await Promise.all((await store.keys()).sort().map(async (key: string) => [key, await store.getItem(key)])) });
      let events = 0; const listener = () => { events++; }; edit.on('featureadd.tc', listener);
      const before = await snapshot();
      edit.importFeatures([edit.layer.features[0].clone()]);
      // Dispatch the real listener retained by the panel opened before revocation.
      document.querySelector<HTMLElement>('.tc-ctl-edit-import-btn-ok')!.click();
      edit.history.undo(edit.layer.features[0]); edit.history.redo(edit.layer.features[0]);
      const after = await snapshot(); edit.off('featureadd.tc', listener);
      for (const event of ['push', 'undo', 'redo']) edit.history.removeEventListener(event, historyListener);
      return { unchanged: before === after, events };
    });
    expect(blockedImport).toEqual({ unchanged: true, events: 0 });
    const rejected = await write.request.post(proxy, { headers: { Authorization: `Bearer ${writeToken}`, 'Content-Type': 'application/xml' }, data: xml });
    expect(rejected.status()).toBe(403); expect((await stats()).transactions).toBe(before.transactions + 1);
  } finally { await viewerContext.close(); await editorContext.close(); await admin.dispose(); }
});
