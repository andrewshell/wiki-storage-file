/*
 * Federated Wiki : Node Server
 *
 * Copyright Ward Cunningham and other contributors
 * Licensed under the MIT license.
 * https://github.com/fedwiki/wiki-server/blob/master/LICENSE.txt
 */

(function() {
  var asSlug, async, events, exports, fs, _glob, path, synopsis;

  fs = require('fs');

  path = require('path');

  events = require('events');

  _glob = require('glob');

  function glob(pattern, options, cb) {
    _glob.glob(pattern, options)
    .then(files => cb(null, files))
    .catch(cb);
  }

  function mkdirp(targetDir, cb) {
    fs.mkdir(targetDir, { recursive: true }, cb);
  }

  async = require('async');

  synopsis = require('./synopsis');

  asSlug = function(name) {
    return name.replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/g, '').toLowerCase();
  };

  module.exports = exports = function(argv) {
    var editDate, fileio, itself, load_parse, queue, serial, wikiName, working;
    wikiName = new URL(argv.url).hostname;
    mkdirp(argv.db, function(e) {
      if (e) {
        throw e;
      }
    });
    load_parse = function(loc, cb, annotations) {
      if (annotations == null) {
        annotations = {};
      }
      return fs.readFile(loc, function(err, data) {
        var e, errorPage, errorPagePath, key, page, recyclePage, val;
        if (err) {
          return cb(err);
        }
        try {
          page = JSON.parse(data);
        } catch (_error) {
          e = _error;
          errorPage = path.basename(loc);
          errorPagePath = path.dirname(loc);
          recyclePage = path.resolve(errorPagePath, '..', 'recycle', errorPage);
          fs.exists(path.dirname(recyclePage), function(exists) {
            if (exists) {
              return fs.rename(loc, recyclePage, function(err) {
                if (err) {
                  return console.log("ERROR: moving problem page " + loc + " to recycler", err);
                } else {
                  return console.log("ERROR: problem page " + loc + " moved to recycler");
                }
              });
            } else {
              return mkdirp(path.dirname(recyclePage), function(err) {
                if (err) {
                  return console.log("ERROR: creating recycler", err);
                } else {
                  return fs.rename(loc, recyclePage, function(err) {
                    if (err) {
                      return console.log("ERROR: moving problem page " + loc + " to recycler", err);
                    } else {
                      return console.log("ERROR: problem page " + loc + " moved to recycler");
                    }
                  });
                }
              });
            }
          });
          return cb(null, 'Error Parsing Page', 404);
        }
        for (key in annotations) {
          val = annotations[key];
          page[key] = val;
        }
        return cb(null, page);
      });
    };
    queue = [];
    fileio = function(action, file, page, cb) {
      var copyFile, loc;
      if (file.startsWith('recycler/')) {
        loc = path.join(argv.recycler, file.split('/')[1]);
      } else {
        loc = path.join(argv.db, file);
      }
      switch (action) {
        case 'delete':
          if (file.startsWith('recycler/')) {
            return fs.exists(loc, function(exists) {
              if (exists) {
                return fs.unlink(loc, function(err) {
                  return cb(err);
                });
              }
            });
          } else {
            return fs.exists(loc, function(exists) {
              var recycleLoc;
              if (exists) {
                recycleLoc = path.join(argv.recycler, file);
                return fs.exists(path.dirname(recycleLoc), function(exists) {
                  if (exists) {
                    return fs.rename(loc, recycleLoc, function(err) {
                      return cb(err);
                    });
                  } else {
                    return mkdirp(path.dirname(recycleLoc), function(err) {
                      if (err) {
                        cb(err);
                      }
                      return fs.rename(loc, recycleLoc, function(err) {
                        return cb(err);
                      });
                    });
                  }
                });
              } else {
                return cb('page does not exist');
              }
            });
          }
          break;
        case 'recycle':
          copyFile = function(source, target, cb) {
            var cbCalled, done, rd, wr;
            done = function(err) {
              var cbCalled;
              if (!cbCalled) {
                cb(err);
                cbCalled = true;
              }
            };
            cbCalled = false;
            rd = fs.createReadStream(source);
            rd.on('error', function(err) {
              done(err);
            });
            wr = fs.createWriteStream(target);
            wr.on('error', function(err) {
              done(err);
            });
            wr.on('close', function(ex) {
              done();
            });
            rd.pipe(wr);
          };
          return fs.exists(loc, function(exists) {
            var recycleLoc;
            if (exists) {
              recycleLoc = path.join(argv.recycler, file);
              return fs.exists(path.dirname(recycleLoc), function(exists) {
                if (exists) {
                  return copyFile(loc, recycleLoc, function(err) {
                    return cb(err);
                  });
                } else {
                  return mkdirp(path.dirname(recycleLoc), function(err) {
                    if (err) {
                      cb(err);
                    }
                    return copyFile(loc, recycleLoc, function(err) {
                      return cb(err);
                    });
                  });
                }
              });
            } else {
              return cb('page does not exist');
            }
          });
        case 'get':
          return fs.exists(loc, function(exists) {
            var defloc;
            if (exists) {
              return load_parse(loc, cb, {
                plugin: void 0
              });
            } else {
              defloc = path.join(argv.root, 'default-data', 'pages', file);
              console.log(defloc, defloc.length);
              return fs.exists(defloc, function(exists) {
                console.log(exists);
                if (exists) {
                  return load_parse(defloc, cb);
                } else {
                  return glob("wiki-plugin-*/pages", {
                    cwd: argv.packageDir
                  }, function(e, plugins) {
                    var giveUp, plugin, _i, _len, _results;
                    if (e) {
                      return cb(e);
                    }
                    if (plugins.length === 0) {
                      cb(null, 'Page not found', 404);
                    }
                    giveUp = (function() {
                      var count;
                      count = plugins.length;
                      return function() {
                        count -= 1;
                        if (count === 0) {
                          return cb(null, 'Page not found', 404);
                        }
                      };
                    })();
                    _results = [];
                    for (_i = 0, _len = plugins.length; _i < _len; _i++) {
                      plugin = plugins[_i];
                      _results.push((function() {
                        var pluginName, pluginloc;
                        pluginName = plugin.slice(12, -6);
                        pluginloc = path.join(argv.packageDir, plugin, file);
                        return fs.exists(pluginloc, function(exists) {
                          if (exists) {
                            return load_parse(pluginloc, cb, {
                              plugin: pluginName
                            });
                          } else {
                            return giveUp();
                          }
                        });
                      })());
                    }
                    return _results;
                  });
                }
              });
            }
          });
        case 'put':
          page = JSON.stringify(page, null, 2);
          return fs.exists(path.dirname(loc), function(exists) {
            if (exists) {
              return fs.writeFile(loc, page, function(err) {
                if (err) {
                  console.log("ERROR: write file " + loc + " ", err);
                }
                return cb(err);
              });
            } else {
              return mkdirp(path.dirname(loc), function(err) {
                if (err) {
                  cb(err);
                }
                return fs.writeFile(loc, page, function(err) {
                  if (err) {
                    console.log("ERROR: write file " + loc + " ", err);
                  }
                  return cb(err);
                });
              });
            }
          });
        default:
          return console.log("pagehandler: unrecognized action " + action);
      }
    };
    working = false;
    serial = function(item) {
      if (item) {
        itself.start();
        return fileio(item.action, item.file, item.page, function(err, data, status) {
          process.nextTick(function() {
            return serial(queue.shift());
          });
          return item.cb(err, data, status);
        });
      } else {
        return itself.stop();
      }
    };
    itself = new events.EventEmitter;
    itself.start = function() {
      working = true;
      return this.emit('working');
    };
    itself.stop = function() {
      working = false;
      return this.emit('finished');
    };
    itself.isWorking = function() {
      return working;
    };
    itself.get = function(file, cb) {
      queue.push({
        action: 'get',
        file: file,
        page: null,
        cb: cb
      });
      if (!working) {
        return serial(queue.shift());
      }
    };
    itself.put = function(file, page, cb) {
      queue.push({
        action: 'put',
        file: file,
        page: page,
        cb: cb
      });
      if (!working) {
        return serial(queue.shift());
      }
    };
    itself["delete"] = function(file, cb) {
      queue.push({
        action: 'delete',
        file: file,
        page: null,
        cb: cb
      });
      if (!working) {
        return serial(queue.shift());
      }
    };
    itself.saveToRecycler = function(file, cb) {
      queue.push({
        action: 'recycle',
        file: file,
        page: null,
        cb: cb
      });
      if (!working) {
        return serial(queue.shift());
      }
    };
    editDate = function(journal) {
      var action, _i, _ref;
      _ref = journal || [];
      for (_i = _ref.length - 1; _i >= 0; _i += -1) {
        action = _ref[_i];
        if (action.date && action.type !== 'fork') {
          return action.date;
        }
      }
      return void 0;
    };
    itself.pages = function(cb) {
      var extractPageLinks;
      extractPageLinks = function(collaborativeLinks, currentItem, currentIndex, array) {
        var err, linkRe, match;
        try {
          linkRe = /\[\[([^\]]+)\]\]/g;
          match = void 0;
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
      };
      return fs.readdir(argv.db, function(e, files) {
        var doSitemap;
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
              pageLinksMap = page.story.reduce(extractPageLinks, new Map());
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
      return fs.readdir(argv.db, function(e, files) {
        if (e) {
          console.log('Problem reading pages directory', e);
          return cb(e);
        } else {
          return cb(null, files);
        }
      });
    };
    return itself;
  };

}).call(this);
