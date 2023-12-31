const path = require('path');

const PageHandler = require('./pagehandler');

module.exports = function (storage, argv) {
  const wikiName = new URL(argv.url).hostname;
  const fs = storage(argv);
  const fsBackup = require('./storage.file.js')(argv);

  function load_parse(file, cb, annotations, myfs) {
    if (annotations == null) {
      annotations = {};
    }
    if (myfs == null) {
      myfs = fs;
    }
    return myfs.readFile(file, function(err, data) {
      var e, errorPage, errorPagePath, key, page, recyclePage, val;
      if (err) {
        return cb(err);
      }
      try {
        page = JSON.parse(data);
      } catch (_error) {
        e = _error;
        return myfs.rename(file, `recycler/${file}`, function(err) {
          if (err) {
            console.log("ERROR: moving problem page " + file + " to recycler", err);
          } else {
            console.log("ERROR: problem page " + file + " moved to recycler");
          }
          return cb(null, 'Error Parsing Page', 404);
        });
      }
      for (key in annotations) {
        val = annotations[key];
        page[key] = val;
      }
      return cb(null, page);
    });
  };

  function fileio(action, file, page, cb) {
    switch (action) {
      case 'delete':
        if (file.startsWith('recycler/')) {
          return fs.exists(file, function(exists) {
            if (exists) {
              return fs.unlink(file, function(err) {
                return cb(err);
              });
            }
          });
        } else {
          return fs.exists(file, function(exists) {
            var recycleFile;
            if (exists) {
              recycleFile = `recycler/${file}`;
              return fs.rename(file, recycleFile, function(err) {
                return cb(err);
              });
            } else {
              return cb('page does not exist');
            }
          });
        }
        break;
      case 'recycle':
        return fs.exists(file, function(exists) {
          var recycleFile;
          if (exists) {
            recycleFile = `recycler/${file}`;
            return fs.copyFile(file, recycleFile, function(err) {
              return cb(err);
            });
          } else {
            return cb('page does not exist');
          }
        });
      case 'get':
        return fs.exists(file, function(exists) {
          var defloc;
          if (exists) {
            return load_parse(file, cb, {
              plugin: void 0
            });
          } else {
            defloc = path.join(argv.root, 'default-data', 'pages', file);
            return fsBackup.exists(defloc, function(exists) {
              if (exists) {
                return load_parse(defloc, cb, {}, fsBackup);
              } else {
                return fsBackup.glob("wiki-plugin-*/pages", {
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
                      return fsBackup.exists(pluginloc, function(exists) {
                        if (exists) {
                          return load_parse(pluginloc, cb, {
                            plugin: pluginName
                          }, fsBackup);
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
        return fs.exists(path.dirname(file), function(exists) {
          if (exists) {
            return fs.writeFile(file, page, function(err) {
              if (err) {
                console.log("ERROR: write file " + file + " ", err);
              }
              return cb(err);
            });
          } else {
            return fs.writeFile(file, page, function(err) {
              if (err) {
                console.log("ERROR: write file " + file + " ", err);
              }
              return cb(err);
            });
          }
        });
      case 'slugs':
        return fs.readDir('', cb);
      default:
        return cb("pagehandler: unrecognized action " + action);
    }
  }

  const itself = PageHandler(wikiName, fileio);

  return itself;
};
