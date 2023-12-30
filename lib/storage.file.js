(function() {

  const fs = require('fs');
  const glob = require('glob');
  const path = require('path');

  module.exports = exports = function(argv) {
    const storage = {};

    function fileLoc(file) {
      try {
        fs.accessSync(file);
        return file;
      } catch (err) {
        // file doesn't exist
      }

      let loc;
      if (file.startsWith('recycler/')) {
        loc = path.join(argv.recycler, file.split('/')[1]);
      } else {
        loc = path.join(argv.db, file);
      }
      return loc;
    }

    storage.copyFile = function (source, target, cb) {
      const sLoc = fileLoc(source);
      const tLoc = fileLoc(target);

      return fs.mkdir(path.dirname(tLoc), {recursive: true}, function (err) {
        if (err) {
          return cb(err);
        }

        let cbCalled, rd, wr;
        function done(err) {
          if (!cbCalled) {
            cb(err);
            cbCalled = true;
          }
        };

        cbCalled = false;
        rd = fs.createReadStream(sLoc);
        rd.on('error', done);
        wr = fs.createWriteStream(tLoc);
        wr.on('error', done);
        wr.on('close', function(ex) {
          done();
        });
        rd.pipe(wr);
      });
    }

    storage.exists = function (file, cb) {
      const loc = fileLoc(file);
      fs.access(loc, (err) => {
        cb(!err);
      });
    }

    storage.glob = function (pattern, options, cb) {
      glob.glob(pattern, options)
      .then(files => cb(null, files))
      .catch(cb);
    };

    storage.readFile = function (file, cb) {
      const loc = fileLoc(file);
      return fs.readFile(loc, cb);
    }

    storage.readDir = function (file, cb) {
      const loc = fileLoc(file);
      return fs.readdir(loc, cb);
    }

    storage.rename = function (source, target, cb) {
      const sLoc = fileLoc(source);
      const tLoc = fileLoc(target);
      return fs.mkdir(path.dirname(tLoc), {recursive: true}, function (err) {
        if (err) {
          return cb(err);
        }

        fs.rename(sLoc, tLoc, cb);
      });
    }

    storage.unlink = function (file, cb) {
      const loc = fileLoc(file);
      return fs.unlink(loc, cb);
    }

    storage.writeFile = function (file, page, cb) {
      const loc = fileLoc(file);
      return fs.mkdir(path.dirname(loc), {recursive: true}, function (err) {
        if (err) {
          return cb(err);
        }

        fs.writeFile(loc, page, cb);
      });
    }

    return storage;
  };

}).call(this);
