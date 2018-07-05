/*global require,exports*/
/********************************************************************
 * Copyright (C) 2017
 *
 * @author wanghaiyang
 * @date 2017/9/20
 *
 ********************************************************************
 */
'use strict'

module.exports = {
    createMongo: require('./lib/mongo').createNew,
    createRedis: require('./lib/redis').createNew
}