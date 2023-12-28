const fs = require('fs');
const pagehandler = require('./page');
const path = require('path');
const util = require('util');

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getArgv(argv) {
  if (null == argv) {
    argv = {};
  }

  if (null == argv.page) {
    argv.page = path.resolve(__dirname, '..', 'test-page');
  }

  if (null == argv.db) {
    argv.db = argv.page + '/pages';
  }

  if (null == argv.recycler) {
    argv.recycler = argv.page + '/recycle';
  }

  if (null == argv.url) {
    argv.url = 'http://localhost:3000';
  }

  if (null == argv.packageDir) {
    argv.packageDir = path.resolve(__dirname, '..', 'node_modules');
  }

  if (null == argv.root) {
    argv.root = argv.packageDir + '/wiki-server';
  }

  return argv;
}

beforeEach(() => {
    const argv = getArgv();
    fs.rmSync(argv.page, { force: true, recursive: true });
});

afterEach(() => {
    const argv = getArgv();
    fs.rmSync(argv.page, { force: true, recursive: true });
});

test('returns existing page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const get = util.promisify(itself.get);
  const put = util.promisify(itself.put);

  await put('example-a', { title: 'Example A' });

  const page = await get('example-a');

  expect(page).toEqual(expect.objectContaining({
      title: expect.stringMatching('Example A')
  }));
});

test('returns missing page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const get = util.promisify(itself.get);

  const page = await get('example-a');

  expect(page).toBe('Page not found');
});

test('returns default page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const get = util.promisify(itself.get);

  const page = await get('how-to-wiki');

  expect(page).toEqual(expect.objectContaining({
    title: expect.stringMatching('How To Wiki')
  }));
});

test('returns plugin page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const get = util.promisify(itself.get);

  const page = await get('about-paragraph-plugin');

  expect(page).toEqual(expect.objectContaining({
    title: expect.stringMatching('About Paragraph Plugin')
  }));
});

test('returns recycled page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const get = util.promisify(itself.get);
  const put = util.promisify(itself.put);

  await put('recycler/old-page', { title: 'Old Page' });

  const page = await get('recycler/old-page');

  expect(page).toEqual(expect.objectContaining({
    title: expect.stringMatching('Old Page')
  }));
});

test('returns badly formatted page correctly', async () => {
  const argv = getArgv();

  fs.mkdirSync(argv.db, { recursive: true });
  fs.writeFileSync(argv.db + '/garbage', '{{{', 'utf8');

  const itself = pagehandler(argv);
  const get = util.promisify(itself.get);

  const page = await get('garbage');

  expect(page).toBe('Error Parsing Page');

  await timeout(5);

  expect(fs.readFileSync(argv.recycler + '/garbage', 'utf8')).toBe('{{{');
});

test('returns badly formatted page correctly overrides recycled', async () => {
  const argv = getArgv();

  fs.mkdirSync(argv.db, { recursive: true });
  fs.writeFileSync(argv.db + '/garbage', '}}}', 'utf8');
  fs.mkdirSync(argv.recycler, { recursive: true });
  fs.writeFileSync(argv.recycler + '/garbage', '{{{', 'utf8');

  const itself = pagehandler(argv);
  const get = util.promisify(itself.get);

  const page = await get('garbage');

  expect(page).toBe('Error Parsing Page');

  await timeout(5);

  expect(fs.readFileSync(argv.recycler + '/garbage', 'utf8')).toBe('}}}');
});

test('deletes page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const del = util.promisify(itself.delete);
  const get = util.promisify(itself.get);
  const put = util.promisify(itself.put);

  await put('example-a', { title: 'Example A' });
  await del('example-a');
  const page = await get('recycler/example-a');

  expect(page).toEqual(expect.objectContaining({
    title: expect.stringMatching('Example A')
  }));
});

test('deletes page correctly overrides recycled', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const del = util.promisify(itself.delete);
  const get = util.promisify(itself.get);
  const put = util.promisify(itself.put);

  await put('example-a', { title: "Example A" });
  await put('recycler/example-a', { title: "Old Page" });
  await del('example-a');
  const page = await get('recycler/example-a');

  expect(page).toEqual(expect.objectContaining({
    title: expect.stringMatching('Example A')
  }));
});

test('deletes recycled page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const del = util.promisify(itself.delete);
  const put = util.promisify(itself.put);

  await put('recycler/example-a', {});
  await del('recycler/example-a');

  expect(() => {
    fs.readFileSync(argv.recycler + '/example-a', 'utf8');
  }).toThrow();
});

test('deletes missing page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const del = util.promisify(itself.delete);

  try {
    await del('example-a');
  } catch (e) {
    expect(e).toBe('page does not exist');
  }
});

test('recycles page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const recycle = util.promisify(itself.saveToRecycler);
  const get = util.promisify(itself.get);
  const put = util.promisify(itself.put);

  await put('example-a', { title: 'Example A' });
  await recycle('example-a');
  const page = await get('recycler/example-a');

  expect(page).toEqual(expect.objectContaining({
    title: expect.stringMatching('Example A')
  }));
});

test('recycles page correctly overrides recycled', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const recycle = util.promisify(itself.saveToRecycler);
  const get = util.promisify(itself.get);
  const put = util.promisify(itself.put);

  await put('example-a', { title: "Example A" });
  await put('recycler/example-a', { title: "Old Page" });
  await recycle('example-a');
  const page = await get('recycler/example-a');

  expect(page).toEqual(expect.objectContaining({
    title: expect.stringMatching('Example A')
  }));
});

test('recycles missing page correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const recycle = util.promisify(itself.saveToRecycler);

  try {
    await recycle('example-a');
  } catch (e) {
    expect(e).toBe('page does not exist');
  }
});

test('returns pages correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const getpages = util.promisify(itself.pages);
  const put = util.promisify(itself.put);

  await put('example-a', {
    title: 'Example A',
    story: [
      {
        "text": "Welcome to this [[Federated Wiki]] site. From this page you can find who we are and what we do. New sites provide this information and then claim the site as their own. You will need your own site to participate.",
        "id": "7b56f22a4b9ee974",
        "type": "paragraph"
      }
    ],
    journal: [
      {
        "type": "create",
        "item": {
          "title": "Welcome Visitors",
          "story": []
        },
        "date": 1420938191608
      }
    ]
  });
  await put('example-b', { title: 'Example B' });

  const sitemap = await getpages();

  expect(sitemap).toHaveLength(2);
  expect(sitemap[0]).toEqual(expect.objectContaining({
    title: expect.stringMatching('Example A'),
    date: 1420938191608,
    links: expect.objectContaining({
      'federated-wiki': expect.stringMatching('7b56f22a4b9ee974')
    })
  }));
});

test('returns slugs correctly', async () => {
  const argv = getArgv();
  const itself = pagehandler(argv);
  const slugs = util.promisify(itself.slugs);
  const put = util.promisify(itself.put);

  await put('example-a', { title: 'Example A' });
  await put('example-b', { title: 'Example B' });

  const pages = await slugs();

  expect(pages).toHaveLength(2);
  expect(pages).toEqual(expect.arrayContaining([
    'example-a',
    'example-b'
  ]));
});
