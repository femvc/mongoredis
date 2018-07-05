'use strict';

var manage = require('./manage')
var Util = require('./util')

module.exports = {
  createNew: function(conf) {
    conf = conf || {}
    if (!conf.dbname || String(conf.dbname).replace(/[0-9a-z_-]+/ig, '')) {
      throw new Error('1st param invalid. [Only 0-9,a-z,_,-]')
    }
    conf.startIndex = conf.startIndex === undefined ? 1000000 : conf.startIndex

    var dbs = manage.createNew({
      dbfile: conf.dbfile || './dbfile/',
      dbname: conf.dbname || 'mongo_' + String(Math.random()).replace('0.', ''),
      startIndex: conf.startIndex,
      runPeriod: conf.runPeriod,
      quickPeriod: conf.quickPeriod,
      fullPeriod: conf.fullPeriod
    })
    dbs.getChangeDiff = function(newdata, olddata) {
      newdata = newdata || []
      olddata = olddata || []

      var keys = {}
      var oldmap = {}
      for (let i = olddata.length - 1; i > -1; i--) {
        oldmap[olddata[i]._id] = olddata[i]
        keys[olddata[i]._id] = true
      }
      var newmap = {}
      for (let i = newdata.length - 1; i > -1; i--) {
        newmap[newdata[i]._id] = newdata[i]
        keys[newdata[i]._id] = true
      }
      var diff = []
      for (let i in keys) {
        if (!Util.isEqual(oldmap[i], newmap[i])) {
          diff.push(JSON.stringify(newmap[i]))
        }
      }

      return diff.join(',\n')
    }


    //  var dataModel = [{
    //  _id: 10001,
    //  id: 100241,
    //  name: 'haiyang',
    //  age: '36'
    // }, {
    //  _id: 10002,
    //  id: 600241,
    //  name: 'qiqi',
    //  age: '9'
    // }]

    // _model 即元数据表， 改了源数据就改了哦
    var dataModel = dbs._model

    var factory = {};
    factory.dbname = conf.dbname;

    factory.getById = function(_id, next) {
      var resp = null
      for (var i = dataModel.length - 1; i > -1; i--) {
        if (String(dataModel[i]._id) === String(_id)) {
          resp = dataModel[i]
          break
        }
      }
      // 深拷贝防止返回结果被误修改
      if (next) next(null, JSON.parse(JSON.stringify(resp)))
    }

    factory.getAll = function(sort, next) {
      if (typeof sort === 'function') {
        next = sort
        sort = null
      }
      var resp = []
      for (var i = dataModel.length - 1; i > -1; i--) {
        resp[i] = dataModel[i]
      }
      if (sort) Util.sortBy(resp, sort)
      if (next) next(null, JSON.parse(JSON.stringify(resp)))
    }

    factory.getItem = function(condition, sort, next) {
      if (typeof sort == 'function') {
        next = sort
        sort = null
      }
      var resp = []
      if (typeof condition === 'function') {
        var list = sort ? Util.sortBy(dataModel, sort) : dataModel
        for (var i = 0, len = list.length; i < len; i++) {
          if (condition(list[i])) {
            resp.push(list[i])
            break
          }
        }
      }
      resp = resp[0] || null
      if (next) next(null, JSON.parse(JSON.stringify(resp)))
    }

    // page: 1, 2, 3, ..., n or condition
    // factory.getItems = function(condition, sort, page, count, next) {

    factory.getItems = function(condition, sort, page, count, next) {
      if (typeof sort === 'function') {
        next = sort
        sort = null
      }
      var resp = []
      if (typeof condition === 'function') {
        var list = sort ? Util.sortBy(dataModel, sort) : dataModel
        for (var i = 0, len = list.length; i < len; i++) {
          if (condition(list[i])) {
            resp.push(list[i])
          }
        }
      }
      if (sort && typeof(sort[0]) == 'function') {
        resp.sort(sort[0])
      } else if (sort) Util.sortBy(resp, sort)

      var pp = 1
      if (typeof page == 'function') {
        pp = page(resp) || 1
      } else {
        pp = parseInt(page) == page ? page : 0
        pp = pp < 1 ? 1 : pp > 2147483646 ? 2147483646 : pp
      }

      count = parseInt(count) == count ? count : 0
      count = count < 1 ? 1 : count > 2147483647 ? 2147483647 : count

      if (next) next(null, JSON.parse(JSON.stringify(resp.slice((pp - 1) * count, pp * count))), resp.length, pp)
    }

    factory.count = function(condition, next) {
      var num = -1
      if (typeof condition === 'function') {
        num = 0
        for (var i = dataModel.length - 1; i > -1; i--) {
          if (condition(dataModel[i])) {
            num++
          }
        }
      }
      if (next) next(null, num)
    }

    factory.insert = function(item, update, opt, next) {
      if (typeof opt === 'function') next = opt
      if (!next) {
        next = update
        update = null
      }
      if (!item) {
        if (next) next('Insert "Item" is null', null);
      }
      var row = {}
      for (var i in item) {
        if (!item.hasOwnProperty(i)) continue;
        row[i] = item[i]
      }
      // 注：处理自增属性，先赋一个默认值startIndex
      var autoIndent = { _id: conf.startIndex }
      if (opt && opt.auto_increment) opt.auto_increment.forEach(function(item1) {
        autoIndent[item1] = conf.startIndex
      })
      // 注：遍历整张表如果发现比默认值还大则在最大值基础上再加一
      for (var key in autoIndent) {
        if (!autoIndent.hasOwnProperty(key)) continue;
        for (i = dataModel.length - 1; i > -1; i--) {
          if (parseInt(dataModel[i][key], 10) > autoIndent[key]) {
            autoIndent[key] = parseInt(dataModel[i][key], 10)
          }
        }
        row[key] = String(autoIndent[key] + 1)
      }

      if (typeof update === 'function') {
        update(row)
      }

      dataModel.push(row)
      var resp = row

      dbs.checkModify()
      if (next) next(null, JSON.parse(JSON.stringify(resp)))
    }

    // http://docs.factorydb.org/manual/reference/method/db.collection.update/#update-parameter
    // {
    //    upsert: <boolean>,
    //    multi: <boolean>
    //  }
    factory.update = function(condition, update, opt, next) { // multi 默认 true, upsert 默认 false
      var err = null
      if (typeof condition !== 'function') err = '1st param should be Fuction'
      if (typeof update !== 'function') err = '2nd param should be Fuction'
      if (typeof opt === 'function') {
        next = opt
        opt = null
      }

      var resp = null
      var exist = false
      if (typeof condition === 'function' && typeof update === 'function') {
        resp = []
        var list = opt && opt.sort ? Util.sortBy(dataModel, opt.sort) : dataModel
        for (var i = 0, len = list.length; i < len; i++) {
          if (condition(list[i])) {
            var _id = list[i]._id
            update(list[i])
            list[i]._id = _id
            resp.push(list[i])
            exist = true
            if (opt && opt.multi === false) break
          }
        }
        // Todo: test it
        if (opt.upsert && !exist) {
          var row = {}
          factory.insert(row, function(item) {
            update(item)
          }, opt, function(err, item) {
            resp.push(item)
          })
        }
      }

      dbs.checkModify()
      if (next) next(err, JSON.parse(JSON.stringify(resp)))
    }

    factory.upsingle = function(condition, update, opt, next) { // multi: false
      if (typeof opt === 'function') {
        next = opt
        opt = null
      }
      opt = opt || {}
      opt.multi = false
      return factory.update(condition, update, opt, function(err, doc) {
        next(err, doc && doc[0] ? doc[0] : null)
      })
    }

    factory.upsert = function(condition, update, opt, next) { // upsert: false
      if (typeof opt === 'function') {
        next = opt
        opt = null
      }
      opt = opt || {}
      opt.upsert = true
      return factory.update(condition, update, opt, next)
    }

    factory.upsertsingle = function(condition, update, opt, next) { // upsert: true, multi: false
      if (typeof opt === 'function') {
        next = opt
        opt = null
      }
      opt = opt || {}
      opt.upsert = true
      opt.multi = false
      return factory.update(condition, update, opt, function(err, doc) {
        next(err, doc && doc[0] ? doc[0] : null)
      })
    }

    factory.updateById = function(_id, update, next) {
      var resp = null
      var err = null
      if (typeof update === 'function') {
        resp = []
        for (var i = dataModel.length - 1; i > -1; i--) {
          if (String(dataModel[i]._id) === String(_id)) {
            update(dataModel[i])
            resp.push(dataModel[i])
            break
          }
        }
      } else err = '2nd param is not Function'

      dbs.checkModify()
      if (next) next(err, JSON.parse(JSON.stringify(resp)));
    }

    factory.remove = function(condition, next) {
      var resp = []
      if (typeof condition === 'function') {
        for (var i = 0, len = dataModel.length; i < len; i++) {
          if (condition(dataModel[i])) {
            dataModel[i] = {
              '_id': dataModel[i]._id
            }
            resp.push(dataModel[i])
          }
        }
      }

      dbs.checkModify()
      if (next) next(null, JSON.parse(JSON.stringify(resp)))
    }

    return factory
  }
}