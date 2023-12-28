const { EventEmitter } = require('events');

const async = require('async');
const synopsis = require('./synopsis');

function asSlug(name) {
  return name.replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/g, '').toLowerCase();
}

function PageHandler(wikiName, fileio) {
  const itself = new EventEmitter();

  let queue = [], working = false;

  function editDate(journal) {
    var action, _i, _ref;
    _ref = journal || [];
    for (_i = _ref.length - 1; _i >= 0; _i += -1) {
      action = _ref[_i];
      if (action.date && action.type !== 'fork') {
        return action.date;
      }
    }
    return undefined;
  };

  function serial(item) {
    if (item) {
      itself.start();
      return fileio(item.action, item.file, item.page, (err, data, status) => {
        process.nextTick(() => {
          return serial(queue.shift());
        });
        return item.cb(err, data, status);
      });
    } else {
      return itself.stop();
    }
  };

  itself.start = function() {
    working = true
    itself.emit('working');
  };

  itself.stop = function() {
    working = false
    itself.emit('finished');
  };

  itself.isWorking = function() {
    return working;
  };

  // get method takes a slug and a callback, adding them to the queue,
  // starting serial if it isn't already working.
  itself.get = function(file, cb) {
    queue.push({action: 'get', file, page: null, cb});
    if (!working) {
      serial(queue.shift());
    }
  };

  // put takes a slugged name, the page as a json object, and a callback.
  // adds them to the queue, and starts it unless it is working.
  itself.put = function(file, page, cb) {
    queue.push({action: 'put', file, page, cb});
    if (!working) {
      serial(queue.shift());
    }
  };

  itself.delete = function(file, cb) {
    queue.push({action: 'delete', file, page: null, cb});
    if (!working) {
      serial(queue.shift());
    }
  };

  itself.saveToRecycler = function(file, cb) {
    queue.push({action: 'recycle', file, page: null, cb});
    if (!working) {
      serial(queue.shift());
    }
  };

  itself.pages = function(cb) {

    function extractPageLinks(collaborativeLinks, currentItem, currentIndex, array) {
      var err, linkRe, match;
      try {
        linkRe = /\[\[([^\]]+)\]\]/g;
        while ((match = linkRe.exec(currentItem.text)) !== null) {
          if (!collaborativeLinks.has(asSlug(match[1]))) {
            collaborativeLinks.set(asSlug(match[1]), currentItem.id);
          }
        }
      } catch (_error) {
        err = _error;
        console.log("METADATA *** " + wikiName + " Error extracting links from " + currentIndex + " of " + (JSON.stringify(array)), err.message);
      }
      return collaborativeLinks;
    }

    fileio('slugs', null, null, function (e, files) {
      let doSitemap;
      if (e) {
        return cb(e);
      }
      doSitemap = function(file, cb) {
        return itself.get(file, function(e, page, status) {
          var err, pageLinks, pageLinksMap;
          if (file.match(/^\./)) {
            return cb();
          }
          if (e || status === 404) {
            console.log('Problem building sitemap:', file, 'e: ', e, 'status:', status);
            return cb();
          }
          try {
            if (Array.isArray(page.story)) {
              pageLinksMap = page.story.reduce(extractPageLinks, new Map());
            } else {
              pageLinksMap = [];
            }
          } catch (_error) {
            err = _error;
            console.log("METADATA *** " + wikiName + " reduce to extract links on " + file + " failed", err.message);
            pageLinksMap = [];
          }
          if (pageLinksMap.size > 0) {
            pageLinks = Object.fromEntries(pageLinksMap);
          } else {
            pageLinks = void 0;
          }
          return cb(null, {
            slug: file,
            title: page.title,
            date: editDate(page.journal),
            synopsis: synopsis(page),
            links: pageLinks
          });
        });
      };
      return async.map(files, doSitemap, function(e, sitemap) {
        if (e) {
          return cb(e);
        }
        return cb(null, sitemap.filter(function(item) {
          if (item != null) {
            return true;
          }
        }));
      });
    });
  };

  itself.slugs = function(cb) {
    fileio('slugs', null, null, function (e, files) {
      if (e) {
        console.log('Problem reading pages directory', e);
        return cb(e);
      } else {
        return cb(null, files);
      }
    });
  };

  return itself;
}

module.exports = PageHandler;
