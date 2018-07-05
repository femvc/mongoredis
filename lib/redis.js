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
      dbname: conf.dbname || 'redis_' + String(Math.random()).replace('0.', ''),
      startIndex: conf.startIndex,
      runPeriod: conf.runPeriod,
      quickPeriod: conf.quickPeriod,
      fullPeriod: conf.fullPeriod
    })
    dbs.getChangeDiff = function(newdata, olddata) {
      newdata = newdata || []
      olddata = olddata || []

      var keys = {}
      var newmap = {}
      for (let i = newdata.length - 1; i > -1; i--) {
        newmap[newdata[i].key] = newdata[i]
        keys[newdata[i].key] = true
      }
      var oldmap = {}
      for (let i = olddata.length - 1; i > -1; i--) {
        oldmap[olddata[i].key] = olddata[i]
      }
      var diff = []
      for (let i in keys) {
        if (!oldmap[i] || oldmap[i].expired != newmap[i].expired || !Util.isEqual(oldmap[i].value, newmap[i].value)) {
          diff.push(JSON.stringify(newmap[i]))
        }
      }

      return diff.join(',\n')
    }

    var monitor = {
      expiredPeriod: (conf.expiredPeriod || 30 * 60 * 1000),
      expiredTimer: null
    }

    //  var dataModel = [{
    //  _id: 10001,
    //  id: 100241,
    //  key: 'haiyang',
    //  value: '36'
    // }, {
    //  _id: 10002,
    //  id: 600241,
    //  key: 'qiqi',
    //  value: '9'
    // }]
    var dataModel = dbs._model

    var factory = {};
    factory.dbname = conf.dbname;

    factory.get = function(key) {
      key = String(key)
      var value = ''
      var now = (new Date()).getTime()
      for (let i = dataModel.length - 1; i > -1; i--) {
        if (dataModel[i].key === key) {
          if (!dataModel[i].expired || Util.parseDate(dataModel[i].expired).getTime() > now) {
            value = dataModel[i].value
          }
          break
        }
      }

      if (conf.expiredPeriod) monitor.checkExpired()
      if (!conf.fixedPeriod) dbs.checkModify()
      return value
    }

    factory.set = function(key, value, expired) {
      if (value === null || value === undefined) value = ''
      // 注释掉原因：value相同，expired不同，也需要更新数据文件
      // if (Util.isEqual(factory.get(key), value)) return;

      key = String(key)
        // value = JSON.stringify(value)

      expired = expired ? Util.formatDate(Util.parseDate((new Date()).getTime() + expired)) : ''

      var _id = conf.startIndex
      for (var i = dataModel.length - 1; i > -1; i--) {
        if (parseInt('0' + String(dataModel[i]._id), 10) > _id) {
          _id = parseInt('0' + String(dataModel[i]._id), 10)
        }
        if (dataModel[i].key === key) {
          dataModel[i].value = value
          dataModel[i].expired = expired
          break
        }
      }
      if (i < 0) { // not exist
        dataModel.push({
          '_id': String(_id + 1),
          'key': key,
          'value': value,
          'expired': expired
        })
      }

      if (conf.expiredPeriod) monitor.checkExpired()
      if (!conf.fixedPeriod) dbs.checkModify()
    }

    factory.clear = function(condition) {
      for (var i = dataModel.length - 1; i > -1; i--) {
        if (typeof condition === 'function' && !condition(dataModel[i])) continue
        dataModel[i] = {
          '_id': dataModel[i]._id
        }
      }

      if (conf.expiredPeriod) monitor.checkExpired()
      if (!conf.fixedPeriod) dbs.checkModify()
    }

    monitor.checkExpired = function() {
      if (monitor.expiredTimer) return;
      monitor.expiredTimer = setTimeout(function(monitor, dataModel) {
        monitor.expiredTimer = null

        var now = (new Date()).getTime()
        for (let i = dataModel.length - 1; i > -1; i--) {
          if (dataModel[i].expired && Util.parseDate(dataModel[i].expired).getTime() < now) {
            dataModel[i] = {
              '_id': dataModel[i]._id
            }
          }
        }
      }.bind({}, monitor, dataModel), monitor.expiredPeriod)
    }

    if (conf.fixedPeriod && !String(conf.fixedPeriod).replace(/\d+/, '') && Number(conf.fixedPeriod)) {
      conf.fixedPeriod = Number(conf.fixedPeriod)
      
      factory.fixedTimer = setInterval(function(dbs) {
        dbs.checkModify()
      }.bind({}, dbs), conf.fixedPeriod)
    } else {
      conf.fixedPeriod = ''
    }

    if (conf.expiredPeriod && !String(conf.expiredPeriod).replace(/\d+/, '') && Number(conf.expiredPeriod)) {
      conf.expiredPeriod = Number(conf.expiredPeriod)
    } else {
      conf.expiredPeriod = ''
    }

    return factory
  }
}