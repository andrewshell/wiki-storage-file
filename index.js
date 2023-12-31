const storage = require('./lib/storage.file.js');
const page = require('./lib/page.js');
module.exports = page.bind(null, storage);
