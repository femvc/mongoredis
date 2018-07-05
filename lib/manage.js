/* global module */
'use strict';
var fs = require('fs')
var path = require('path')
var Util = require('./util')

var JSONParse = function(str) {
  var result
  try {
    result = JSON.parse(str)
  } catch (e) {
    result = Function('return ' + str)()
  }
  return result
}

module.exports = {
  createNew: function(conf) {
    conf = conf || {}
    if (!conf.dbname || String(conf.dbname).replace(/[0-9a-z_-]+/ig, '')) {
      throw new Error('1st param invalid. [Only 0-9,a-z,_,-]')
    }
    var mdb = {
      config: {
        path: conf.dbfile || './dbfile/',
        dbname: conf.dbname || 'tmp',
        startIndex: conf.startIndex === undefined ? 1000000 : conf.startIndex,
        runPeriod: conf.runPeriod || 60 * 1000,
        quickPeriod: conf.quickPeriod || 30 * 60 * 1000,
        fullPeriod: conf.fullPeriod || 24 * 60 * 60 * 1000,
        curbak: 'a'
      },
      _origin: [],
      _model: [
        // {_id: 10001, key: 'tom', value: '10000'},
        // {_id: 10002, key: 'dim', value: '10001'}
      ],
      runTimer: null,
      fullTimer: null,
      quickTimer: null
    }

    // public
    mdb.checkModify = function() {
      if ([conf.runPeriod, conf.quickPeriod, conf.fullPeriod].join('') === '-1-1-1') return ''
      // 注：1. 配合差量备份 2. 防止启动后无任何数据变更也频繁存储
      if (!mdb.getChangeDiff(mdb._model, mdb._origin)) return ''

      // 检查运行备份任务是否在运行
      if (!mdb.runTimer && String(conf.runPeriod) !== '-1') {
        mdb.runTimer = setTimeout(function(mdb) {
          mdb.runTimer = null
          mdb.saveRunFile()
        }.bind({}, mdb), mdb.config.runPeriod)
      }
      // 检查差量备份任务是否在运行
      if (!mdb.quickTimer && String(conf.quickPeriod) !== '-1') {
        mdb.quickTimer = setTimeout(function(mdb) {
          mdb.quickTimer = null
          mdb.saveQuickFile()
        }.bind({}, mdb), mdb.config.quickPeriod)
      }
      // 检查全量备份任务是否在运行
      if (!mdb.fullTimer && String(conf.fullPeriod) !== '-1') {
        mdb.fullTimer = setTimeout(function(mdb) {
          mdb.fullTimer = null
          mdb.saveFullFile()
        }.bind({}, mdb), mdb.config.fullPeriod)
      }
    }

    // public
    mdb.getChangeDiff = function(newdata, olddata) {
      newdata = newdata || []
      olddata = olddata || []

      var diff = []
      for (let i = 0, len = newdata.length; i < len; i++) {
        if (JSON.stringify(newdata[i]) !== JSON.stringify(olddata[i])) {
          diff.push(JSON.stringify(newdata[i]))
        }
      }

      return diff.join(',\n')
    }
    // private
    mdb.getFullContent = function() {
      var result = []
      var list = Util.sortBy(mdb._model, '_id', 'asc')
      for (let i = 0, len = list.length; i < len; i++) {
        result.push(JSON.stringify(list[i]))
      }
      return result.join(',\n')
    }

    // private
    mdb.saveRunFile = function() {
      mdb.readRunFile(function(res) {
        var str = mdb.getFullContent()
        // 有变动才存盘！否则在定时任务下会产生大量重复冗余文件
        if (!Util.isEqual(JSONParse('[' + str + ']'), JSONParse('[' + res + ']'))) {
          var curbak = mdb.config.curbak
          // update db file
          var fpath1 = path.normalize(mdb.config.path + mdb.config.dbname + '_' + curbak + '_run.txt')
          fs.writeFile(fpath1, str, 'utf8', function(err) {
            if (err) return console.error(err)
            // 这里无需切换 mdb.config.curbak，前面的 mdb.readRunFile 中会自动切换 curbak
            console.log(mdb.config.dbname + ' => Full(tmp) save success 1. ' + fpath1)
            var fpath2 = path.normalize(mdb.config.path + mdb.config.dbname + '_' + (curbak == 'a' ? 'b' : 'a') + '_run.txt')
            fs.writeFile(fpath2, str, 'utf8', function(err) {
              if (err) return console.error(err)
              // 这里无需切换 mdb.config.curbak，前面的 mdb.readRunFile 中会自动切换 curbak
              console.log(mdb.config.dbname + ' => Full(tmp) save success 2. ' + fpath2)
            })
          })
        }
      })
    }
    // private
    mdb.saveQuickFile = function() {
      var result = mdb.getChangeDiff(mdb._model, mdb._origin)
      if (result) {
        // 重置_origin[重要!!]
        mdb._origin = JSONParse(JSON.stringify(mdb._model))

        var fpath = path.normalize(mdb.config.path + 'diff_' + mdb.config.dbname + '_' + Util.formatDate(new Date(), 'yyyyMMddHHmmss') + '.txt')
        fs.writeFile(fpath, result, 'utf8', function(err) {
          if (err) return console.error(err)
          console.log(mdb.config.dbname + ' => Quick save success. ' + fpath)
        })
      }
    }
    // private
    mdb.saveFullFile = function() {
      if (mdb.quickTimer) {
        clearTimeout(mdb.quickTimer)
        mdb.quickTimer = null
        mdb.saveQuickFile()
      }

      mdb.readRunFile(function(res) {
        var str = mdb.getFullContent()
        // 有变动才存盘！否则在定时任务下会产生大量重复冗余文件
        if (!Util.isEqual(JSONParse('[' + str + ']'), JSONParse('[' + res + ']'))) {
          var fpath = path.normalize(mdb.config.path + 'full_' + mdb.config.dbname + '_' + Util.formatDate(new Date(), 'yyyyMMddHHmmss') + '.txt')
          fs.writeFile(fpath, str, 'utf8', function(err) {
            if (err) return console.error(err)
            mdb._origin = JSONParse('[' + str + ']')
            console.log(mdb.config.dbname + ' => Full(timestamp) save success. ' + fpath)
          })
        }
      })
    }
    // private
    mdb.readRunFile = function(callback) {
      // 注：使用两个文件代替原来单个文件的方式，主要是防止存储文件时程序异常退出，导致数据文件变成空文件丢失所有数据的情况
      // 注：不过使用双文件备份后，仍会丢失上次到本次保存之间的差集，这点需要特别注意
      var mt1 = false
      var mt2 = false
      var handler = function() {
        if (mt1 !== false && mt2 !== false) {
          mdb.config.curbak = mt1 > mt2 ? 'b' : 'a'
          if (!mt1 && !mt2) callback('')
          else fs.readFile(mt1 > mt2 ? url1 : url2, 'utf8', function(err, fileContent) {
            if (err) return console.error(err)
            callback(fileContent)
          })
        }
      }
      // return [{key: 1, value: 11},{key: 2, value: 22},{key: 3, value: 33}]
      var url1 = path.normalize(mdb.config.path + mdb.config.dbname + '_a_run.txt')
      fs.exists(url1, function(exists) {
        if (exists) {
          fs.stat(url1, function(err, states) {
            if (err) return console.error(err)
            mt1 = states.mtime.getTime()
            handler()
          })
        } else {
          mt1 = ''
          handler()
        }
      })
      var url2 = path.normalize(mdb.config.path + mdb.config.dbname + '_b_run.txt')
      fs.exists(url2, function(exists) {
        if (exists) {
          fs.stat(url2, function(err, states) {
            if (err) return console.error(err)
            mt2 = states.mtime.getTime()
            handler()
          })
        } else {
          mt2 = ''
          handler()
        }
      })
    }

    // private
    mdb.init = function() {
      mdb.readRunFile(function(res) {
        var olddata = JSONParse('[' + res + ']')
        for (let i = olddata.length - 1; i > -1; i--) {
          var str = JSON.stringify(olddata[i])
          mdb._model[i] = JSONParse(str)
          mdb._origin[i] = JSONParse(str)
        }
      })
    }
    mdb.init()

    return mdb
  }
}