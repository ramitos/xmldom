var lab = require('lab').script();
var assert = require('assert');

var xmldom = require('../');
var assets = require('./assets/node.json');


var parseFromString = function(xml, contentType) {
  return new xmldom.DOMParser().parseFromString(xml, contentType);
};

lab.suite('XML Node Parser', function() {
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
});

exports.lab = lab;