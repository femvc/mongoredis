'use strict';

// [order] 1: asc, -1: desc, 0/'': origin
function sortBy(list, field, order) {
  if (!list || !list.sort || !list.length) return list
  var sort = []
  if (typeof field === 'string') {
    sort.push([field, order === undefined ? 'asc' : String(order)])
  } else if (Object.prototype.toString.call(field) === '[object Array]') {
    sort = field
  }

  for (var i = sort.length - 1; i > -1; i--) {
    if (typeof sort[i] === 'string') {
      sort[i] = [sort[i], 'asc']
    } else if (Object.prototype.toString.call(sort[i]) === '[object Array]') {
      if (typeof sort[i][0] !== 'string') sort[i][0] = String(sort[i][0])
      if (String(sort[i][1]) === '-1' || String(sort[i][1]).toLowerCase() === 'desc') {
        sort[i][1] = 'desc'
      } else if (String(sort[i][1]) === '0') {
        sort[i][1] = '0'
      } else sort[i][1] = 'asc'
    }
  }

  // console.log(sort)
  list.sort(function(a, b) {
    if (!a || !b) return !a ? 1 : -1

    var m, n, result = 0
    for (var i = 0, len = sort.length; i < len; i++) {
      if (sort[i][1] === '0') continue;

      if (Object.prototype.toString.call(a[sort[i][0]]) === '[object Number]' && Object.prototype.toString.call(b[sort[i][0]]) === '[object Number]') {
        m = a[sort[i][0]]
        n = b[sort[i][0]]
      } else {
        m = String(a[sort[i][0]]).toLowerCase()
        n = String(b[sort[i][0]]).toLowerCase()
      }
      result = (m > n ? 1 : m < n ? -1 : 0) * (sort[i][1] === 'desc' ? -1 : 1)

      if (result) break
    }
    return result
  })
  return list
}

function isEqual(a, b, aStack, bStack) {
  // Identical objects are equal. `0 === -0`, but they aren't identical.
  // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
  if (a === b) {
    return a !== 0 || 1 / a == 1 / b;
  }
  // A strict comparison is necessary because `null == undefined`.
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (aStack === undefined || bStack === undefined) {
    aStack = [];
    bStack = [];
  }
  // Compare `[[Class]]` names.
  var className = Object.prototype.toString.call(a);
  if (className != Object.prototype.toString.call(b)) {
    return false;
  }
  switch (className) {
    // Strings, numbers, dates, and booleans are compared by value.
    case '[object String]':
      // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
      // equivalent to `new String("5")`.
      return a == String(b);
    case '[object Number]':
      // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
      // other numeric values.
      return a != +a ? b != +b : (a === 0 ? 1 / a === 1 / b : a === +b);
    case '[object Date]':
    case '[object Boolean]':
      // Coerce dates and booleans to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are not equivalent.
      return +a == +b;
      // RegExps are compared by their source patterns and flags.
    case '[object RegExp]':
      return a.source == b.source &&
        a.global == b.global &&
        a.multiline == b.multiline &&
        a.ignoreCase == b.ignoreCase;
  }
  if (typeof a != 'object' || typeof b != 'object') return false;
  // Assume equality for cyclic structures. The algorithm for detecting cyclic
  // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
  var length = aStack.length;
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    if (aStack[length] == a) return bStack[length] == b;
  }
  // Add the first object to the stack of traversed objects.
  aStack.push(a);
  bStack.push(b);

  var size = 0,
    result = true;
  // Recursively compare objects and arrays.
  if (className == '[object Array]') {
    // Compare array lengths to determine if a deep comparison is necessary.
    size = a.length;
    result = size == b.length;
    if (result) {
      // Deep compare the contents, ignoring non-numeric properties.
      while (size--) {
        if (!(result = isEqual(a[size], b[size], aStack, bStack))) break;
      }
    }
  } else {
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor,
      bCtor = b.constructor;
    if (aCtor !== bCtor && !(Object.prototype.toString.call(aCtor) == '[object Function]' && (aCtor instanceof aCtor) &&
        Object.prototype.toString.call(bCtor) == '[object Function]' && (bCtor instanceof bCtor))) {
      return false;
    }
    // Deep compare objects.
    for (var key in a) {
      if (Object.prototype.hasOwnProperty.call(a, key)) {
        // Count the expected number of properties.
        size++;
        // Deep compare each member.
        if (!(result = Object.prototype.hasOwnProperty.call(b, key) && isEqual(a[key], b[key], aStack, bStack))) break;
      }
    }
    // Ensure that both objects contain the same number of properties.
    if (result) {
      for (key in b) {
        if (Object.prototype.hasOwnProperty.call(b, key) && !(size--)) break;
      }
      result = !size;
    }
  }
  // Remove the first object from the stack of traversed objects.
  aStack.pop();
  bStack.pop();

  return result;
}

/**
 * @method hui.formatDate
 * @description 将Date类型解析为String类型. 
 * @param {Date} date 输入的日期
 * @param {String} fmt 输出日期格式
 * @example
 * hui.formatDate(new Date(2006,0,1), 'yyyy-MM-dd HH:mm');
 */
function formatDate(date, fmt) {
  if (!date) date = new Date();
  fmt = fmt || 'yyyy-MM-dd HH:mm:ss';
  var o = {
    'M+': date.getMonth() + 1, //月份      
    'd+': date.getDate(), //日      
    'h+': date.getHours() % 12 === 0 ? 12 : date.getHours() % 12, //小时      
    'H+': date.getHours(), //小时      
    'm+': date.getMinutes(), //分      
    's+': date.getSeconds(), //秒      
    'q+': Math.floor((date.getMonth() + 3) / 3), //季度      
    'S': date.getMilliseconds() //毫秒      
  };
  var week = {
    '0': '/u65e5',
    '1': '/u4e00',
    '2': '/u4e8c',
    '3': '/u4e09',
    '4': '/u56db',
    '5': '/u4e94',
    '6': '/u516d'
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
  }
  if (/(E+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? '/u661f/u671f' : '/u5468') : '') + week[date.getDay() + '']);
  }
  for (var k in o) {
    if (o.hasOwnProperty(k) && new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
    }
  }
  return fmt;
}
/**
 * @method hui.parseDate
 * @description 将String类型解析为Date类型.  
 * @param {String} fmt 输入的字符串格式的日期
 * @example
 * parseDate('2006-1-1') return new Date(2006,0,1)  
 * parseDate(' 2006-1-1 ') return new Date(2006,0,1)  
 * parseDate('2006-1-1 15:14:16') return new Date(2006,0,1,15,14,16)  
 * parseDate(' 2006-1-1 15:14:16 ') return new Date(2006,0,1,15,14,16);  
 * parseDate('不正确的格式') retrun null  
 */
function parseDate(str) {
  str = String(str).replace(/^[\s\xa0]+|[\s\xa0]+$/ig, '');
  var results = null;

  //秒数 #9744242680 
  results = str.match(/^ *(\d{10}) *$/);
  if (results && results.length > 0)
    return new Date(parseInt(str, 10) * 1000);

  //毫秒数 #9744242682765 
  results = str.match(/^ *(\d{13}) *$/);
  if (results && results.length > 0)
    return new Date(parseInt(str, 10));

  //20110608 
  results = str.match(/^ *(\d{4})(\d{2})(\d{2}) *$/);
  if (results && results.length > 3)
    return new Date(parseInt(results[1], 10), parseInt(results[2], 10) - 1, parseInt(results[3], 10));

  //20110608 1010 
  results = str.match(/^ *(\d{4})(\d{2})(\d{2}) +(\d{2})(\d{2}) *$/);
  if (results && results.length > 5)
    return new Date(parseInt(results[1], 10), parseInt(results[2], 10) - 1, parseInt(results[3], 10), parseInt(results[4], 10), parseInt(results[5], 10));

  //2011-06-08 
  results = str.match(/^ *(\d{4})[\._\-\/\\](\d{1,2})[\._\-\/\\](\d{1,2}) *$/);
  if (results && results.length > 3)
    return new Date(parseInt(results[1], 10), parseInt(results[2], 10) - 1, parseInt(results[3], 10));

  //2011-06-08 10:10 
  results = str.match(/^ *(\d{4})[\._\-\/\\](\d{1,2})[\._\-\/\\](\d{1,2}) +(\d{1,2}):(\d{1,2}) *$/);
  if (results && results.length > 5)
    return new Date(parseInt(results[1], 10), parseInt(results[2], 10) - 1, parseInt(results[3], 10), parseInt(results[4], 10), parseInt(results[5], 10));

  //2011/06\\08 10:10:10 
  results = str.match(/^ *(\d{4})[\._\-\/\\](\d{1,2})[\._\-\/\\](\d{1,2}) +(\d{1,2}):(\d{1,2}):(\d{1,2}) *$/);
  if (results && results.length > 6)
    return new Date(parseInt(results[1], 10), parseInt(results[2], 10) - 1, parseInt(results[3], 10), parseInt(results[4], 10), parseInt(results[5], 10), parseInt(results[6], 10));

  return (new Date(str));
}

module.exports = {
  'sortBy': sortBy,
  'isEqual': isEqual,
  'formatDate': formatDate,
  'parseDate': parseDate
}