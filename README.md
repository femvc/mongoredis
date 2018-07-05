# mongoredis
---
一个简洁的基于 Node 的 mongo 及 redis 库（不依赖 mongo 及 redis 原来的应用服务）

## Install
```bash
$ npm install mongoredis
```

### 使用说明
```bash
1. 引用mongoredis
var mgr = require('mongoredis')

2. 创建mongo或redis实例
var redis = mgr.createRedis({
  dbname: 'session',
  dbname: 'user',
  startIndex: 1000000,
  runPeriod: 60 * 1000, // 临时缓存同步时间，默认一分钟，-1 表示关闭
  quickPeriod: -1, // 差异备份时间周期，默认半小时，-1 表示关闭
  fullPeriod: -1, // 全量备份时间周期，默认一天，-1 表示关闭
  fixedPeriod: 30 * 1000, // 数据变动定时检测周期，-1 表示关闭，默认30秒（仅redis有此设置，mongo 无）
  expiredPeriod: 30 * 60 * 1000 // 数据过期检测周期，-1 表示关闭，默认30分（仅redis有此设置，mongo 无）
})

// 注：fixedPeriod参数意义在于 通常redis操作非常频繁，因此采用变更触发的方式会非常耗性能，此时定时检测反倒效率更高；
// 注：定时触发关闭时会自动切换至变更触发状态
// 注：expiredPeriod参数意义在于 通常会将redis用于存储临时数据，因此指定过期时间很有必要，mongo则不然；
// 注：expiredPeriod表示过期定时自动检测的时间周期

var mongo = mgr.createMongo({
  dbname: 'user',
  fullPeriod: 10 * 1000,
  quickPeriod: 3 * 1000
})

3. 操作mongo或redis
redis.set('status', 'logined', 30 * 60 * 1000)
console.log(redis.get('status'))

mongo.insert({
  'username': 'guest',
  'age': 20
}, function(err, result) {
    res.send(result)
})
mongo.getItem(function(row) {
  return String(row.username) === 'guest'
}, function(err, result) {
  res.send(result)
})


```
