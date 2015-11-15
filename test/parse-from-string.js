var lab = require('lab').script();
var toJSON = require('document-to-json');
var assert = require('assert');

var xmldom = require('../');
var assets = require('./assets/parse-from-string.json');


var parseFromString = function(xml, contentType, opts) {
  return new xmldom.DOMParser(opts).parseFromString(xml, contentType);
};
//
// var _catch = function(fn) {
//   return function(done) {
//     try {
//       fn(done);
//     } catch(err) {}
//   };
// };

lab.suite('parseFromString', function() {
  lab.test('element', function(done) {
    var dom = parseFromString(assets.element);

    assert.equal(dom.childNodes.length, 1);
    assert.equal(dom.documentElement.childNodes.length, 1);
    assert.equal(dom.documentElement.tagName, 'xml');
    assert.equal(dom.documentElement.firstChild.tagName, 'child');

    done();
  });

  lab.test('text', function(done) {
    var dom = parseFromString(assets.text);

    assert.equal(dom.documentElement.firstChild.data, 'start center end');
    assert.equal(dom.documentElement.firstChild.nextSibling, null);

    done();
  });

  lab.test('cdata', function(done) {
    var dom = parseFromString(assets.cdata);
    var firstChild = dom.documentElement.firstChild;
    var nextSibling = firstChild.nextSibling.nextSibling.nextSibling;

    assert.equal(firstChild.data, 'start ');
    assert.equal(firstChild.nextSibling.data, '<encoded>');
    assert.equal(nextSibling.data, '[[[[[[[[]]]]]]]]');

    done();
  });

  lab.test('cdata empty', function(done) {
    var dom = parseFromString(assets['cdata empty']);

    assert.equal(dom.documentElement.textContent, 'start  end');

    done();
  });

  lab.test('comment', function(done) {
    var dom = parseFromString(assets.comment);

    assert.equal(dom.documentElement.firstChild.nodeValue, ' comment&>< ');

    done();
  });

  lab.test('cdata comment', function(done) {
    var dom = parseFromString(assets['cdata comment']);

    var firstChild = dom.documentElement.firstChild;
    var nextSibling = firstChild.nextSibling.nextSibling.nextSibling;

    assert.equal(firstChild.nodeValue, 'start ');
    assert.equal(firstChild.nextSibling.nodeValue, '<encoded>');
    assert.equal(nextSibling.nodeValue, ' comment ');
    assert.equal(nextSibling.nextSibling.nodeValue, 'end');

    done();
  });

  lab.test('append node', function(done) {
    var dom = parseFromString(assets['append node']);
    var child = dom.createElement('child');
    var fragment = new dom.createDocumentFragment();

    assert.equal(dom.documentElement.appendChild(child), child);
    assert.equal(dom.documentElement.firstChild, child);
    assert.equal(fragment.appendChild(child), child);

    done();
  });

  lab.test('insert node', function(done) {
    var dom = parseFromString(assets['insert node']);
    var node = dom.createElement('sibling');
    var child = dom.documentElement.firstChild;

    child.parentNode.insertBefore(node, child);

    assert.equal(child.previousSibling, node);
    assert.equal(node.nextSibling, child);
    assert.equal(node.parentNode, child.parentNode);

    done();
  });

  lab.test('insert fragment', function(done) {
    var dom = parseFromString(assets['insert fragment']);
    var fragment = dom.createDocumentFragment();

    var first = fragment.appendChild(dom.createElement('first'));
    var last = fragment.appendChild(dom.createElement('last'));

    assert.equal(fragment.nodeType, 11);

    assert.equal(fragment.firstChild, first);
    assert.equal(fragment.lastChild, last);
    assert.equal(last.previousSibling, first);
    assert.equal(first.nextSibling, last);

    var child = dom.documentElement.firstChild;
    child.parentNode.insertBefore(fragment, child);

    assert.equal(last.previousSibling, first);
    assert.equal(first.nextSibling, last);
    assert.equal(child.parentNode.firstChild, first);
    assert.equal(child.previousSibling, last);
    assert.equal(last.nextSibling, child);
    assert.equal(first.parentNode, child.parentNode);
    assert.equal(last.parentNode, child.parentNode);

    done();
  });

  lab.test('instruction', function(done) {
    var doc = parseFromString(assets.instruction, 'text/xml');
    var source = new xmldom.XMLSerializer().serializeToString(doc);

    assert.equal(assets.instruction, source);

    done();
  });

  lab.test('noAttribute', function(done) {
    assets.noAttribute.forEach(function(xml) {
      assert.deepEqual(toJSON(parseFromString(xml, 'text/xml')), {
        name: 'xml',
        childs: [],
        attrs: {}
      });
    });

    done();
  });

  lab.test('simpleAttribute', function(done) {
    assets.simpleAttribute[0].forEach(function(xml) {
      assert.deepEqual(toJSON(parseFromString(xml, 'text/xml')), {
        name: 'xml',
        childs: [],
        attrs: {
          a: '1',
          b: '2'
        }
      });
    });

    assets.simpleAttribute[1].forEach(function(xml) {
      assert.deepEqual(toJSON(parseFromString(xml, 'text/xml')), {
        name: 'xml',
        childs: [],
        attrs: {
          a: '1',
          b: ''
        }
      });
    });

    done();
  });

  lab.test('nsAttribute', function(done) {
    assets.nsAttribute.forEach(function(xml) {
      assert.deepEqual(toJSON(parseFromString(xml, 'text/xml')), {
        name: 'xml',
        childs: [],
        attrs: {
          xmlns: '1',
          'xmlns:a': '2',
          'a:test': '3'
        }
      });
    });

    done();
  });

  lab.suite('errorHandle', function() {
    lab.test('simple', function(done) {
      var doc = parseFromString(assets.errorHandle.simple, 'text/html');

      assert.deepEqual(toJSON(doc), {
        name: 'html',
        childs: [
          {
            name: 'body',
            childs: [],
            attrs: {
              title: '1<2'
            }
          }
        ],
        attrs: {}
      });

      done();
    });

    lab.test('only function two args', function(done) {
      var xml = assets.errorHandle['only function two args'];
      var errors = [];

      var doc = parseFromString(xml, 'text/html', {
        errorHandler: function(key, msg) {
          errors.push({
            key: key,
            msg: msg
          });
        }
      });

      console.log(errors);

      done();
    });
  });
});

exports.lab = lab;

// 'only function two args': function() {
//   var error = {}
//   var parser = new DOMParser({
//     errorHandler: function(key, msg) {
//       error[key] = msg
//     }
//   });
//   try {
//     var doc = parser.parseFromString('', 'text/xml');
//     console.assert(error.warning != null, 'error.error:' + error.warning);
//     console.assert(error.error != null, 'error.error:' + error.error);
//     console.assert(error.fatalError != null, 'error.error:' + error.fatalError);
//     //console.log(doc+'')
//   } catch (e) {}
// },
// 'only function': function() {
//   var error = []
//   var parser = new DOMParser({
//     errorHandler: function(msg) {
//       error.push(msg)
//     }
//   });
//   try {
//     var doc = parser.parseFromString('<html disabled><1 1="2"/></body></html>', 'text/xml');
//     error.map(function(e) {
//       error[e.replace(/\:[\s\S]*/, '')] = e
//     })
//     console.assert(error.warning != null, 'error.error:' + error.warning);
//     console.assert(error.error != null, 'error.error:' + error.error);
//     console.assert(error.fatalError != null, 'error.error:' + error.fatalError);
//     //console.log(doc+'')
//   } catch (e) {}
// },
// 'only function': function() {
//   var error = []
//   var errorMap = []
//   new DOMParser({
//     errorHandler: function(msg) {
//       error.push(msg)
//     }
//   }).parseFromString('<html><body title="1<2">test</body></html>', 'text/xml');
//   'warn,warning,error,fatalError'.replace(/\w+/g, function(k) {
//     var errorHandler = {};
//     errorMap[k] = [];
//     errorHandler[k] = function(msg) {
//       errorMap[k].push(msg)
//     }
//     new DOMParser({
//       errorHandler: errorHandler
//     }).parseFromString('<html><body title="1<2">test</body></html>', 'text/xml');
//   });
//   for (var n in errorMap) {
//     console.assert(error.length == errorMap[n].length)
//   }
// },
// 'error function': function() {
//   var error = []
//   var parser = new DOMParser({
//     locator: {},
//     errorHandler: {
//       error: function(msg) {
//         error.push(msg);
//         throw new Error(msg)
//       }
//     }
//   });
//   try {
//     var doc = parser.parseFromString('<html><body title="1<2"><table>&lt;;test</body></body></html>', 'text/html');
//   } catch (e) {
//     console.log(e);
//     console.assert(/\n@#\[line\:\d+,col\:\d+\]/.test(error.join(' ')), 'line,col must record:' + error)
//     return;
//   }
//   console.assert(false, doc + ' should be null');
// }